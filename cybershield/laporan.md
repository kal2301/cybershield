# LAPORAN SINGKAT - APLIKASI CYBERSHIELD

**Mata Kuliah:** Keamanan Jaringan
**Nama / NIM:** [Nama Anda] / [NIM Anda]
**Dosen:** Aliyah, S.Kom., M.T.I

## 1. Tujuan Aplikasi
CyberShield adalah aplikasi web untuk memantau aktivitas jaringan, mengelola aturan firewall, dan menampilkan simulasi ancaman keamanan jaringan. Aplikasi membantu memahami cara kerja firewall (allow/block berdasarkan IP dan port), blacklist IP, serta pencatatan log keamanan.

## 2. Rancangan Sistem
- **Frontend:** HTML, CSS, JavaScript (tema gelap, grafik traffic real-time dengan canvas).
- **Backend:** PHP (PDO, prepared statement) dengan endpoint JSON `api.php`.
- **Database:** MySQL.
- **Data:** traffic dan serangan dihasilkan secara simulasi.

**Alur kerja:** paket simulasi (IP sumber + port tujuan) -> cek blacklist -> cek aturan firewall aktif -> jika tidak ada aturan cocok, serangan diblokir IDS dan traffic normal diizinkan -> hasil disimpan ke `security_logs` -> statistik dashboard diperbarui.

**Fitur:** Dashboard Monitoring, Manajemen Aturan Firewall, Simulasi Traffic & Serangan, Log Keamanan, Blacklist IP.

## 3. Struktur Database
**firewall_rules**: id, rule_name, ip_address, port, action (allow/block), is_active, created_at
**security_logs**: id, event_time, source_ip, dest_port, activity_type, action_taken (allowed/blocked), note
**blacklist_ips**: id, ip_address (unique), reason, created_at
**system_stats** (tambahan): id, total_packets, allowed_count, blocked_count

## 4. Hasil Pengujian
| No | Skenario | Hasil Diharapkan | Hasil Aktual | Status |
|---|---|---|---|---|
| 1 | Uji 192.168.1.10 : 443 | Diizinkan | | |
| 2 | Uji 198.51.100.23 : 23 | Diblokir (aturan Telnet) | | |
| 3 | Uji 45.155.205.12 : 443 | Diblokir (blacklist) | | |
| 4 | Tambah aturan blokir port 21, uji | Diblokir | | |
| 5 | Nonaktifkan aturan, uji ulang | Diizinkan | | |
| 6 | Simulasi serangan | Paket serangan diblokir | | |
| 7 | Pencatatan log | Semua kejadian tercatat | | |

(Isi kolom "Hasil Aktual" dan sisipkan screenshot.)

## 5. Kesimpulan
Aplikasi berhasil mensimulasikan pemantauan jaringan dan penerapan firewall: koneksi diizinkan dan diblokir sesuai aturan, serta seluruh kejadian tercatat pada log keamanan.
