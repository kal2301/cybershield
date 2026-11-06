<?php
/**
 * CyberShield - REST API sederhana (JSON)
 * Semua query memakai prepared statement (anti SQL Injection).
 */
require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) { $in = $_POST; }

function out($data) { echo json_encode(['ok' => true] + $data); exit; }
function fail(string $msg, int $code = 400) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

/* ---------------- VALIDASI ---------------- */
function validIpPattern(string $p): bool {
    if ($p === '*') return true;
    if (filter_var($p, FILTER_VALIDATE_IP)) return true;
    if (preg_match('#^(\d{1,3}\.){3}\d{1,3}/(\d|[12]\d|3[0-2])$#', $p)) return filter_var(explode('/', $p)[0], FILTER_VALIDATE_IP) !== false;
    if (preg_match('/^(\d{1,3}|\*)(\.(\d{1,3}|\*)){3}$/', $p)) return true; // wildcard 192.168.1.*
    return false;
}
function validPortPattern(string $p): bool {
    if ($p === '*') return true;
    if (!preg_match('/^\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*$/', $p)) return false;
    preg_match_all('/\d+/', $p, $m);
    foreach ($m[0] as $n) { if ((int)$n < 1 || (int)$n > 65535) return false; }
    return true;
}

/* ---------------- MESIN FIREWALL ---------------- */
function ipMatch(string $pat, string $ip): bool {
    if ($pat === '*' || $pat === '') return true;
    if (strpos($pat, '/') !== false) {
        [$net, $bits] = explode('/', $pat);
        $bits = (int)$bits;
        $mask = $bits === 0 ? 0 : ((~0 << (32 - $bits)) & 0xFFFFFFFF);
        return (ip2long($ip) & $mask) === (ip2long($net) & $mask);
    }
    if (strpos($pat, '*') !== false) return fnmatch($pat, $ip);
    return $pat === $ip;
}
function portMatch(string $pat, int $port): bool {
    if ($pat === '*' || $pat === '') return true;
    foreach (explode(',', $pat) as $part) {
        if (strpos($part, '-') !== false) {
            [$a, $b] = explode('-', $part);
            if ($port >= (int)$a && $port <= (int)$b) return true;
        } elseif ((int)$part === $port) {
            return true;
        }
    }
    return false;
}
function loadContext(PDO $db): array {
    return [
        'bl'    => array_column($db->query('SELECT ip_address FROM blacklist_ips')->fetchAll(), 'ip_address'),
        'rules' => $db->query('SELECT * FROM firewall_rules WHERE is_active = 1 ORDER BY id ASC')->fetchAll(),
    ];
}
/** Urutan evaluasi: 1) Blacklist  2) Aturan firewall aktif (berurutan)  3) IDS / default izinkan */
function evaluate(array $ctx, string $ip, int $port, bool $isAttack): array {
    if (in_array($ip, $ctx['bl'], true)) return ['blocked', 'Masuk blacklist IP'];
    foreach ($ctx['rules'] as $r) {
        if (ipMatch($r['ip_address'], $ip) && portMatch($r['port'], $port)) {
            return [$r['action'] === 'allow' ? 'allowed' : 'blocked', 'Aturan: ' . $r['rule_name']];
        }
    }
    return $isAttack
        ? ['blocked', 'Terdeteksi IDS (signature serangan)']
        : ['allowed', 'Tidak ada aturan cocok (default izinkan)'];
}
function saveEvents(PDO $db, array $events): void {
    $ins = $db->prepare('INSERT INTO security_logs (source_ip, dest_port, activity_type, action_taken, note) VALUES (?,?,?,?,?)');
    $allowed = 0; $blocked = 0;
    $db->beginTransaction();
    foreach ($events as $e) {
        $ins->execute([$e['ip'], $e['port'], $e['activity'], $e['action'], $e['note']]);
        $e['action'] === 'allowed' ? $allowed++ : $blocked++;
    }
    $db->prepare('UPDATE system_stats SET total_packets = total_packets + ?, allowed_count = allowed_count + ?, blocked_count = blocked_count + ? WHERE id = 1')
       ->execute([$allowed + $blocked, $allowed, $blocked]);
    $db->commit();
}

/* ---------------- GENERATOR TRAFFIC SIMULASI ---------------- */
function randomNormalPacket(): array {
    $ports = [80 => 'Akses HTTP', 443 => 'Akses HTTPS', 53 => 'DNS Query', 8080 => 'HTTP Proxy', 21 => 'FTP Transfer', 22 => 'SSH Session'];
    $port = array_rand($ports);
    $subnets = ['192.168.1.', '192.168.1.', '10.0.0.', '172.16.5.'];
    $ip = $subnets[array_rand($subnets)] . random_int(2, 80);
    return ['ip' => $ip, 'port' => $port, 'activity' => $ports[$port], 'attack' => false];
}
function randomAttackPacket(): array {
    $attacks = [
        [22, 'Brute Force SSH'], [23, 'Telnet Probe'], [445, 'SMB Exploit Attempt'],
        [1433, 'SQL Injection'], [3306, 'SQL Injection'], [3389, 'RDP Brute Force'],
        [80, 'DDoS HTTP Flood'], [8080, 'Port Scan'],
    ];
    $ips = ['45.155.205.12', '185.220.101.7', '103.77.192.45', '91.240.118.3', '203.0.113.66', '198.51.100.23'];
    [$port, $type] = $attacks[array_rand($attacks)];
    return ['ip' => $ips[array_rand($ips)], 'port' => $port, 'activity' => $type, 'attack' => true];
}

/* ---------------- ROUTER ---------------- */
try {
    $db = db();

    switch ($action) {

    /* ===== DASHBOARD ===== */
    case 'stats':
        $s = $db->query('SELECT * FROM system_stats WHERE id = 1')->fetch();
        $active = (int)$db->query('SELECT COUNT(*) FROM firewall_rules WHERE is_active = 1')->fetchColumn();
        $ports = $db->query("SELECT dest_port AS port, COUNT(*) AS total FROM security_logs WHERE action_taken='blocked' GROUP BY dest_port ORDER BY total DESC LIMIT 5")->fetchAll();
        $alerts = $db->query("SELECT event_time, source_ip, dest_port, activity_type, note FROM security_logs WHERE action_taken='blocked' ORDER BY id DESC LIMIT 8")->fetchAll();
        out([
            'total'   => (int)$s['total_packets'],
            'allowed' => (int)$s['allowed_count'],
            'blocked' => (int)$s['blocked_count'],
            'active_rules' => $active,
            'top_ports' => $ports,
            'alerts' => $alerts,
        ]);

    /* ===== FIREWALL ===== */
    case 'rules_list':
        out(['rules' => $db->query('SELECT * FROM firewall_rules ORDER BY id DESC')->fetchAll()]);

    case 'rule_add':
        $name = trim($in['rule_name'] ?? '');
        $ip   = trim($in['ip_address'] ?? '*') ?: '*';
        $port = trim($in['port'] ?? '*') ?: '*';
        $act  = $in['action'] ?? '';
        if ($name === '' || mb_strlen($name) > 100) fail('Nama aturan wajib diisi (maks. 100 karakter).');
        if (!validIpPattern($ip))   fail('Format IP tidak valid. Contoh: 192.168.1.10, 192.168.1.*, 10.0.0.0/24, atau *');
        if (!validPortPattern($port)) fail('Format port tidak valid. Contoh: 80, 80-90, 80,443, atau *');
        if (!in_array($act, ['allow', 'block'], true)) fail('Aksi harus allow atau block.');
        $db->prepare('INSERT INTO firewall_rules (rule_name, ip_address, port, action) VALUES (?,?,?,?)')
           ->execute([$name, $ip, $port, $act]);
        out(['message' => 'Aturan firewall ditambahkan.']);

    case 'rule_toggle':
        $id = (int)($in['id'] ?? 0);
        $db->prepare('UPDATE firewall_rules SET is_active = 1 - is_active WHERE id = ?')->execute([$id]);
        out(['message' => 'Status aturan diubah.']);

    case 'rule_delete':
        $id = (int)($in['id'] ?? 0);
        $db->prepare('DELETE FROM firewall_rules WHERE id = ?')->execute([$id]);
        out(['message' => 'Aturan dihapus.']);

    /* ===== SIMULASI ===== */
    case 'simulate':
        $mode  = ($in['mode'] ?? 'normal') === 'attack' ? 'attack' : 'normal';
        $count = max(1, min(50, (int)($in['count'] ?? 10)));
        $ctx = loadContext($db);
        $events = [];
        for ($i = 0; $i < $count; $i++) {
            // Mode serangan: 80% paket serangan, 20% trafik normal sebagai latar
            $pkt = ($mode === 'attack' && random_int(1, 100) <= 80) ? randomAttackPacket() : randomNormalPacket();
            [$action_, $note] = evaluate($ctx, $pkt['ip'], $pkt['port'], $pkt['attack']);
            $events[] = ['ip' => $pkt['ip'], 'port' => $pkt['port'], 'activity' => $pkt['activity'], 'action' => $action_, 'note' => $note];
        }
        saveEvents($db, $events);
        $a = count(array_filter($events, fn($e) => $e['action'] === 'allowed'));
        $out = array_map(fn($e) => $e + ['time' => date('H:i:s')], $events);
        out(['packets' => $out, 'allowed' => $a, 'blocked' => count($events) - $a]);

    case 'test_connection':
        $ip = trim($in['ip'] ?? '');
        $port = (int)($in['port'] ?? 0);
        if (!filter_var($ip, FILTER_VALIDATE_IP)) fail('IP tidak valid.');
        if ($port < 1 || $port > 65535) fail('Port harus 1 - 65535.');
        $ctx = loadContext($db);
        [$act, $note] = evaluate($ctx, $ip, $port, false);
        saveEvents($db, [['ip' => $ip, 'port' => $port, 'activity' => 'Uji Koneksi Manual', 'action' => $act, 'note' => $note]]);
        out(['result' => $act, 'note' => $note, 'ip' => $ip, 'port' => $port]);

    /* ===== LOG ===== */
    case 'logs_list':
        $f = $_GET['filter'] ?? 'all';
        if (in_array($f, ['allowed', 'blocked'], true)) {
            $st = $db->prepare('SELECT * FROM security_logs WHERE action_taken = ? ORDER BY id DESC LIMIT 200');
            $st->execute([$f]);
        } else {
            $st = $db->query('SELECT * FROM security_logs ORDER BY id DESC LIMIT 200');
        }
        out(['logs' => $st->fetchAll()]);

    case 'logs_clear':
        $db->exec('DELETE FROM security_logs');
        out(['message' => 'Semua log dihapus.']);

    /* ===== BLACKLIST ===== */
    case 'blacklist_list':
        out(['items' => $db->query('SELECT * FROM blacklist_ips ORDER BY id DESC')->fetchAll()]);

    case 'blacklist_add':
        $ip = trim($in['ip_address'] ?? '');
        $reason = trim($in['reason'] ?? '');
        if (!filter_var($ip, FILTER_VALIDATE_IP)) fail('Alamat IP tidak valid.');
        $cek = $db->prepare('SELECT COUNT(*) FROM blacklist_ips WHERE ip_address = ?');
        $cek->execute([$ip]);
        if ($cek->fetchColumn() > 0) fail('IP sudah ada di blacklist.');
        $db->prepare('INSERT INTO blacklist_ips (ip_address, reason) VALUES (?,?)')
           ->execute([$ip, mb_substr($reason, 0, 255) ?: 'Ditambahkan manual']);
        out(['message' => 'IP ditambahkan ke blacklist.']);

    case 'blacklist_delete':
        $id = (int)($in['id'] ?? 0);
        $db->prepare('DELETE FROM blacklist_ips WHERE id = ?')->execute([$id]);
        out(['message' => 'IP dihapus dari blacklist.']);

    default:
        fail('Aksi tidak dikenal.', 404);
    }
} catch (PDOException $e) {
    fail('Database error: ' . $e->getMessage() . ' (pastikan database.sql sudah diimport & config.php benar)', 500);
} catch (Throwable $e) {
    fail('Server error: ' . $e->getMessage(), 500);
}
