-- =====================================================
-- CyberShield - Database
-- Import lewat phpMyAdmin (tab Import) atau: mysql -u root < database.sql
-- =====================================================
CREATE DATABASE IF NOT EXISTS cybershield CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE cybershield;

DROP TABLE IF EXISTS security_logs;
DROP TABLE IF EXISTS blacklist_ips;
DROP TABLE IF EXISTS firewall_rules;
DROP TABLE IF EXISTS system_stats;

-- 1. Aturan firewall
CREATE TABLE firewall_rules (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  rule_name   VARCHAR(100) NOT NULL,
  ip_address  VARCHAR(50)  NOT NULL DEFAULT '*',      -- IP, wildcard (192.168.1.*), CIDR (10.0.0.0/24), atau *
  port        VARCHAR(50)  NOT NULL DEFAULT '*',      -- 80, 80-90, 80,443, atau *
  action      ENUM('allow','block') NOT NULL DEFAULT 'block',
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Log keamanan
CREATE TABLE security_logs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  event_time    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_ip     VARCHAR(45) NOT NULL,
  dest_port     INT         NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  action_taken  ENUM('allowed','blocked') NOT NULL,
  note          VARCHAR(255) DEFAULT NULL,
  INDEX idx_action (action_taken),
  INDEX idx_time (event_time)
) ENGINE=InnoDB;

-- 3. Blacklist IP
CREATE TABLE blacklist_ips (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  ip_address  VARCHAR(45) NOT NULL UNIQUE,
  reason      VARCHAR(255) DEFAULT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Penghitung statistik dashboard (tabel tambahan)
CREATE TABLE system_stats (
  id            INT PRIMARY KEY,
  total_packets BIGINT NOT NULL DEFAULT 0,
  allowed_count BIGINT NOT NULL DEFAULT 0,
  blocked_count BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ---------------- DATA AWAL (SIMULASI) ----------------
INSERT INTO system_stats (id, total_packets, allowed_count, blocked_count) VALUES (1, 124580, 118920, 5660);

INSERT INTO firewall_rules (rule_name, ip_address, port, action, is_active) VALUES
('Blokir Telnet',              '*',            '23',   'block', 1),
('Blokir SMB',                 '*',            '445',  'block', 1),
('Blokir RDP Eksternal',       '*',            '3389', 'block', 1),
('Izinkan Web HTTPS',          '*',            '443',  'allow', 1),
('Blokir Subnet Mencurigakan', '203.0.113.*',  '*',    'block', 0);

INSERT INTO blacklist_ips (ip_address, reason) VALUES
('45.155.205.12',  'Brute force SSH berulang'),
('185.220.101.7',  'Scanning port massal'),
('91.240.118.3',   'Terindikasi botnet C2');

INSERT INTO security_logs (event_time, source_ip, dest_port, activity_type, action_taken, note) VALUES
(NOW() - INTERVAL 1  MINUTE, '45.155.205.12', 22,   'Brute Force SSH',      'blocked', 'Masuk blacklist IP'),
(NOW() - INTERVAL 2  MINUTE, '192.168.1.15',  443,  'Akses HTTPS',          'allowed', 'Aturan: Izinkan Web HTTPS'),
(NOW() - INTERVAL 3  MINUTE, '198.51.100.23', 23,   'Telnet Probe',         'blocked', 'Aturan: Blokir Telnet'),
(NOW() - INTERVAL 4  MINUTE, '192.168.1.22',  80,   'Akses HTTP',           'allowed', 'Tidak ada aturan cocok (default izinkan)'),
(NOW() - INTERVAL 6  MINUTE, '185.220.101.7', 8080, 'Port Scan',            'blocked', 'Masuk blacklist IP'),
(NOW() - INTERVAL 7  MINUTE, '203.0.113.66',  445,  'SMB Exploit Attempt',  'blocked', 'Aturan: Blokir SMB'),
(NOW() - INTERVAL 9  MINUTE, '10.0.0.8',      53,   'DNS Query',            'allowed', 'Tidak ada aturan cocok (default izinkan)'),
(NOW() - INTERVAL 11 MINUTE, '91.240.118.3',  3306, 'SQL Injection',        'blocked', 'Masuk blacklist IP'),
(NOW() - INTERVAL 12 MINUTE, '103.77.192.45', 3389, 'RDP Brute Force',      'blocked', 'Aturan: Blokir RDP Eksternal'),
(NOW() - INTERVAL 14 MINUTE, '192.168.1.40',  443,  'Akses HTTPS',          'allowed', 'Aturan: Izinkan Web HTTPS'),
(NOW() - INTERVAL 15 MINUTE, '198.51.100.23', 445,  'SMB Exploit Attempt',  'blocked', 'Aturan: Blokir SMB'),
(NOW() - INTERVAL 18 MINUTE, '45.155.205.12', 22,   'Brute Force SSH',      'blocked', 'Masuk blacklist IP'),
(NOW() - INTERVAL 20 MINUTE, '203.0.113.66',  80,   'DDoS HTTP Flood',      'blocked', 'Terdeteksi IDS (signature serangan)'),
(NOW() - INTERVAL 22 MINUTE, '192.168.1.9',   8080, 'HTTP Proxy',           'allowed', 'Tidak ada aturan cocok (default izinkan)');
