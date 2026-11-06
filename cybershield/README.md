# CyberShield - Network Security Monitor

Aplikasi web untuk memantau aktivitas jaringan, mengelola aturan firewall, dan mensimulasikan serangan (data simulasi).
Dibuat dengan HTML, CSS, JavaScript, PHP (PDO) dan MySQL.

## Cara Menjalankan (XAMPP / Laragon)

1. Salin folder `cybershield` ke `C:\xampp\htdocs\` (XAMPP) atau `C:\laragon\www\` (Laragon).
2. Nyalakan **Apache** dan **MySQL**.
3. Buka `http://localhost/phpmyadmin` -> tab **Import** -> pilih `database.sql` -> **Go**.
   (Database `cybershield` + 4 tabel + data awal otomatis dibuat.)
4. Cek `config.php`. Default: user `root`, password kosong.
5. Buka `http://localhost/cybershield/`.

> Jangan buka `index.html` langsung dengan double-click (file://), karena PHP harus lewat server.

## Struktur File

| File | Fungsi |
|---|---|
| `index.html` | Antarmuka (5 halaman dalam 1 file) |
| `style.css` | Tema gelap profesional |
| `app.js` | Logika UI, grafik real-time, pemanggilan API |
| `api.php` | Backend: firewall engine, simulasi, CRUD |
| `config.php` | Koneksi database (PDO) |
| `database.sql` | Struktur tabel + data awal |

## Database

- `firewall_rules` : aturan firewall (nama, IP, port, aksi allow/block, aktif/nonaktif)
- `security_logs` : waktu, IP sumber, port tujuan, jenis aktivitas, tindakan sistem
- `blacklist_ips` : daftar IP yang diblokir
- `system_stats` : penghitung statistik dashboard (tabel tambahan)

## Logika Firewall (urutan evaluasi)

1. IP ada di **blacklist** -> **diblokir**
2. Cocok dengan **aturan firewall aktif** (urut ID terkecil) -> ikut aksi aturan (allow / block)
3. Tidak ada aturan cocok: paket serangan -> **diblokir IDS**, traffic normal -> **diizinkan**

Format aturan: IP `*`, `192.168.1.10`, `192.168.1.*`, `10.0.0.0/24`; Port `*`, `80`, `80-90`, `80,443`.

## Skenario Pengujian (untuk laporan + screenshot)

| No | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Menu Simulasi -> Uji Koneksi `192.168.1.10` port `443` | DIIZINKAN (aturan Izinkan Web HTTPS) |
| 2 | Uji Koneksi `192.168.1.10` port `80` | DIIZINKAN (default izinkan) |
| 3 | Uji Koneksi `198.51.100.23` port `23` | DIBLOKIR (aturan Blokir Telnet) |
| 4 | Uji Koneksi `45.155.205.12` port `443` | DIBLOKIR (blacklist menang atas aturan allow) |
| 5 | Tambah aturan: Blokir FTP, IP `*`, port `21`, BLOKIR, lalu uji `192.168.1.10` port `21` | DIBLOKIR |
| 6 | Nonaktifkan aturan tadi, uji ulang | DIIZINKAN |
| 7 | Klik **Jalankan Simulasi Serangan** | Mayoritas paket DIBLOKIR, counter dashboard naik |
| 8 | Tambah IP `203.0.113.66` ke Blacklist, uji port `80` | DIBLOKIR |
| 9 | Hapus IP dari Blacklist, uji lagi | Tidak lagi diblokir oleh blacklist |
| 10 | Menu Log Keamanan | Semua pengujian di atas tercatat (waktu, IP, port, aktivitas, tindakan) |

Ambil screenshot di tiap langkah penting sebagai bukti.
