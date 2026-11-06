<?php
// Konfigurasi koneksi database (sesuaikan dengan XAMPP/Laragon kamu)
const DB_HOST = 'localhost';
const DB_NAME = 'cybershield';
const DB_USER = 'root';
const DB_PASS = '';   // XAMPP/Laragon default kosong

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    }
    return $pdo;
}
