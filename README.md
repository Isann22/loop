# Python Loop Visualizer

Web interaktif berbahasa Indonesia untuk melihat alur `for`, `while`, dan nested loop Python, satu langkah logis setiap kali. Buka `index.html` langsung di browser. Tidak perlu instalasi, server, atau koneksi internet.

## Cara memakai

1. Pilih tab dan atur input.
2. Tekan **Langkah Berikutnya** untuk menjalankan satu operasi, atau **Mulai / Lanjutkan** untuk menjalankan otomatis.
3. Gunakan **Jeda** untuk menahan posisi, **Reset** untuk mulai dari awal, dan **Kecepatan** untuk mengatur jeda animasi.

Sorotan kode, kartu sumber, nilai variabel, penghitung, penjelasan, dan output mengikuti langkah yang sama. Pada string, satu kartu mewakili satu karakter. Simbol ␠, ↵, dan ⇥ membantu melihat spasi, baris baru, dan tab pada kartu.

## Batas simulasi

- Maksimal 60 nilai dari satu sumber angka atau string ditelusuri.
- Maksimal 120 pelaksanaan `print()` dan 500 langkah.
- Input teks maksimal 2.000 karakter.

Jika batas tercapai, status menunjukkan **Batas simulasi tercapai**. Kode Python yang tampil hanya disimulasikan oleh JavaScript, bukan dijalankan oleh interpreter Python.

## Arah tampilan

Tampilan mengikuti kebutuhan proyeksi kelas: huruf besar, kontras kuat, panel kode gelap, dan kartu nilai yang memiliki label status tertulis. Hijau menandai nilai aktif pada loop tunggal; biru dan jingga membedakan loop luar dan loop dalam. Gerak dibatasi pada perpindahan status agar urutan eksekusi mudah diikuti.
