# Python Loop Visualizer

Web interaktif berbahasa Indonesia untuk melihat alur `for`, `while`, dan nested loop Python, satu langkah logis setiap kali. Buka `index.html` langsung di browser. Tidak perlu instalasi, server, atau koneksi internet.

Pilih tab dan atur input di bagian atas kartu. Kontrol berada tepat di bawah input. Kode Python yang disorot, kartu nilai yang sedang diproses, dan output `print()` berada dalam tampilan yang sama. Hanya tiga nilai di sekitar posisi aktif yang ditampilkan; tanda titik menunjukkan nilai lain yang tetap diproses oleh simulasi. Gunakan **Langkah Berikutnya** untuk satu operasi, **Mulai / Lanjutkan** untuk menjalankan otomatis, **Jeda** untuk menahan posisi, dan **Reset** untuk kembali ke awal.

Pada kartu string, ␠ berarti spasi, ↵ berarti baris baru, dan ⇥ berarti tab. Label teks tetap menunjukkan status nilai tanpa bergantung pada warna.

Simulasi dibatasi hingga 60 nilai per sumber, 120 pelaksanaan `print()`, dan 500 langkah. Input teks maksimal 2.000 karakter. Jika batas tercapai, status menunjukkan **Batas simulasi tercapai**. JavaScript menyimulasikan kode yang tampil tanpa interpreter Python.
