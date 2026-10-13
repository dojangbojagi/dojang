# GYEVO — handoff globe onboarding (13 Okt 2026)

Dokumen ini menjelaskan **cara membuat globe di onboarding putih** (yang ada di belakang "PROVE MORE. REVEAL LESS."),
kenapa jaringannya rapat tapi tetap bagus, dan apa saja yang harus dijaga. Ditulis supaya siapa pun (kamu, PM, Codex,
atau sesi Claude baru) bisa membuat ulang atau menyetel globe ini tanpa menebak-nebak.

Semua angka di sini diambil dari kode per 13 Okt 2026. Kodenya hanya **3 file** (lihat §1), tanpa dependency baru
(tidak ada three.js, tidak ada R3F). Kalau angka di dokumen ini beda dengan kode, **kode yang benar**.

---

## 0. Baca ini dulu

1. **Jangan ubah cara scroll cover.** Globe hanya *membaca* progress `p` dari `cover-reveal.tsx`. Panjang runway,
   `--e/--h/--k/--q/--s`, Lenis, dan hero gelap di bawahnya tidak disentuh.
2. **Globe berpusat di titik hitam headline (`.lp-slot`).** Titik itu adalah "nilai privat yang tersegel". Jangan
   pindahkan pusatnya ke tengah layar, nanti konsepnya hilang dan balok tirai tidak lagi terbuka dari pusat globe.
3. **Warna hanya charcoal/abu + burgundy.** Wine `#B81A34` di atas putih terlihat pink dan sudah pernah ditolak.
   Putih tetap putih (tidak boleh jadi hero gelap).
4. **Tidak ada `position: relative` di `.lp-words` / `.lp-slot`.** Lihat §6, ini sudah pernah merusak posisi balok tirai.
5. Performa adalah syarat keras. Aturannya ada di §5.

---

## 1. File yang terlibat

| File | Peran |
|---|---|
| `src/components/landing/globe-sculpture.ts` | **Globe-nya.** Canvas 2D + perspektif buatan sendiri. Tidak punya React, hanya `createGlobeSculpture(canvas)`. |
| `src/components/landing/cover-reveal.tsx` | Memasang canvas (`.lp-globe`), memanggil `resize(slot)` di `measure()` dan `setProgress(p)` di `paint()`. |
| `src/components/landing/landing.css` | `.lp-globe` (z-index -1), `.lp-p1 { isolation: isolate }`, halo putih di `.lp-sub`. |
| `src/components/landing/cipher-sculpture.ts` | Balok tirai. Sejak pass ke-2 tiap sisi balok punya mesh + node yang sama dengan globe (`drawMesh`). |

API globe:

```ts
const globe = createGlobeSculpture(canvas); // null kalau canvas 2D tidak tersedia
globe.resize(slotEl);        // ukur canvas + posisi titik; dipanggil dari measure()
globe.setProgress(p);        // p = 0..1, progress "opening" cover; dipanggil dari paint()
globe.setReduced(boolean);   // prefers-reduced-motion
globe.destroy();             // final: setelah ini semua method jadi no-op
```

---

## 2. Kenapa globe ini terlihat bagus dan rapat (inti idenya)

### 2.1 Jaringan, bukan peta
Globe lat/long biasa terlihat seperti globe Pendle. Punya GYEVO dibuat sebagai **jaringan node**:

1. Titik tersebar rata di bola dengan **Fibonacci sphere** (tidak ada kutub yang menumpuk).
2. Tiap titik dihubungkan ke **5 tetangga terdekat**, dengan batas panjang `1.62 × jarak rata-rata`.
3. Hasilnya mesh segitiga yang terlihat seperti triangulasi, tanpa mesher.

```ts
// Fibonacci sphere
const ga = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < n; i++) {
  const y = 1 - ((i + 0.5) * 2) / n;
  const r = Math.sqrt(1 - y * y);
  const th = ga * i;
  x = Math.cos(th) * r;  z = Math.sin(th) * r;
}
// tetangga: untuk tiap i ambil 5 j terdekat dengan d2 <= (spacing * 1.62)^2,
// spacing = Math.sqrt(4 * Math.PI / n); de-duplikasi pasangan (a*4096 + b).
```

Catatan: kunci pasangan `a * 4096 + b` hanya aman kalau `n < 4096`. Naikkan kalau node-nya lebih banyak.

### 2.2 Kerapatan = jumlah node, bukan tebal garis
Jarak antar node di layar kira-kira:

```
jarak (px) ≈ sqrt(4π / N) × R        R = radius bola di layar
```

| Versi | N | R (1440×900) | Jarak antar node | Hasil |
|---|---|---|---|---|
| Pass 1 | 400 | 423 px | ~75 px | **Terlalu renggang** (kata PM) |
| Sekarang | 1200 | 423 px | ~43 px | Rapat, masih terbaca sebagai jaringan |
| Mobile | 640 | ~195 px | ~27 px | Sama rapatnya relatif ke bola |

Aturan praktis: **jaga jarak antar node di kisaran 40–50 px pada desktop.** Lebih jarang dari itu terasa kosong,
lebih rapat dari ~30 px menjadi gumpalan abu-abu di atas putih (di latar gelap referensi Pendle bisa lebih rapat
karena garis menambah cahaya; di putih garis menambah gelap).

Dan **rapat tidak boleh berarti berat**, karena itu:

- garis **tipis**: 0.62 px (sisi jauh) dan 0.7 px (sisi dekat); 3 level paling terang ×1.2
- alpha dipengaruhi kedalaman: tepi dekat sampai `A_OUT = 0.6`, tepi jauh hampir hilang
- node hanya persegi 1–2 px, bukan lingkaran besar

### 2.3 Bagian dalam terbaca "di dalam" (ini yang dikeluhkan PM)
Versi pertama menggambar inti lattice di atas mesh, jadi terlihat menempel di depan/di luar. Sekarang urutan gambar
**dari belakang ke depan** dengan satu lapis kaca di tengah:

```
1. debu (titik halus, jauh)
2. mesh sisi JAUH + separuh belakang orbit
3. shell kedua (r = 0.62, burgundy, lebih lembut)
4. inti: ikosahedron burgundy + oktahedron kecil berputar berlawanan
5. VEIL: lingkaran putih radial (alpha ~0.28) menutupi 2–4
6. mesh sisi DEKAT (tajam) + separuh depan orbit + node terverifikasi + busur proof
7. pemudaran tepi (nav & marquee) + area pudar di belakang teks
```

Kunci kesan "di dalam": **garis depan menyilang di atas inti**, dan inti sedikit "tertutup kaca".
Veil hanya berlaku saat kamera di luar bola (`cz > 1.2`) dan hilang sendiri saat scroll
(`1 - smooth(0.02, 0.3, p)`), karena setelah kamera masuk tidak ada lagi "sisi dekat" yang menutupi.

### 2.4 Teks tidak bertabrakan dengan globe
Tiga lapis, dari yang paling berpengaruh:

1. **Area pudar** (`destination-out`, elips radial) yang mengikuti kotak `.lp-words` + `.lp-sub`.
   Ukurannya dibaca dari DOM saat `resize()`:
   `rx = setengahLebar × 1.06 + 40`, `ry = setengahTinggi × 1.2 + 28`.
   Gradiennya 0.74 → 0.64 → 0.30 → 0 (tengah ke tepi), jadi garis di belakang teks **tipis, bukan hilang**.
   Kekuatannya mengecil ke 0 pada `p = 0.1 → 0.42` (saat kata-kata sudah pergi).
2. **Halo putih CSS** di `.lp-sub`: `text-shadow: 0 0 .55em #fff, 0 0 1.2em #fff, 0 0 .2em #fff`.
3. Headline hitam tebal besar, jadi kontrasnya sudah tinggi.

Tips: kalau area pudar dibuat terlalu kuat, inti ikut hilang (inti memang tepat di belakang teks). Pass pertama
sempat begitu; itu sebabnya elipsnya dibuat sempit dan intinya diperbesar (`coreR = 0.5`).

### 2.5 Titik hitam = inti
Globe dipusatkan di slot titik (`slot.getBoundingClientRect()` relatif ke canvas). Inti lattice mengelilingi titik itu.
Saat scroll, titik itu membuka jadi balok tirai, jadi kamera "masuk ke inti" lalu inti membuka. Itu yang membuat
transisinya terasa satu ruang, bukan dua layar.

---

## 3. Gerak: idle dan scroll

### Idle (sebelum scroll)
- Rotasi pelan: `yaw = secs × 0.075`, tilt tetap, sedikit condong ke pointer (mouse saja, ±0.2 rad, di-ease).
- Busur proof: kepala terang berjalan di sepanjang busur di permukaan (periode 5.4–8.6 s). Busur **tidak pernah
  masuk ke inti**, artinya hanya bukti yang lewat, nilainya tidak keluar.
- 2 orbit tipis dengan 1–2 node pengendara + ekor pendek.
- Intro saat load (~2.1 s): node mulai longgar lalu menyatu ke bola, alpha naik dari 0.35.

### Scroll (`p` = progress opening, 0..1)
Semua murni fungsi `(p, waktu)`, jadi mundur otomatis.

```ts
const x  = clamp01(p / 0.85);
const u  = 0.3 * x + 0.7 * smoothstep(x);          // sabar di awal, cepat di tengah
const cz = CZ0 * Math.pow(CZ1 / CZ0, u);           // CZ0 = 3.6, CZ1 = 0.62 (jarak kamera, satuan radius)
const sep = smooth(0.05, 0.8, p) * 0.95 + loose;   // shell merenggang jadi awan node
node: r = 1 + sep * (0.22 + 1.15 * seed[i])        // tiap node bergeser keluar berbeda
privateTint = smooth(0.12, 0.8, p)                 // garis charcoal → burgundy
yaw  = secs*0.075 + p*2.1 + 0.55;  pitch = 0.34 - p*0.3;
```

Apa yang terlihat: p 0–0.25 bola mendekat dan masih terbaca bola; 0.3–0.5 kamera menembus shell, garis besar
lewat di samping; 0.5+ yang tersisa awan node dan inti, tertutup balok tirai. Globe menghilang pada
`gone = smooth(0.7, 0.97, p)`; di `p ≥ 0.97` loop berhenti dan canvas dibersihkan.

### Balok tirai ikut gaya yang sama
`cipher-sculpture.ts` → `drawMesh()` menggambar di tiap sisi balok: garis kisi tiap ~44 px, satu diagonal per sel
(selang-seling, jadi segitiga), titik node di persilangan, alpha `0.05 + key × 0.17` (key = terang sisi itu).
Diagonal hanya jika `du × dv ≤ 70`, node hanya jika titik ≤ 120, supaya biaya terkendali.

---

## 4. Ukuran dan layout

| Hal | Aturan |
|---|---|
| Radius desktop (> 860 px) | `R = min(0.34 × lebar, 0.47 × tinggi)` |
| Radius mobile (≤ 860 px) | `R = min(0.5 × lebar, 0.36 × tinggi)` |
| Focal length | `f = R × sqrt(CZ0² − 1)` supaya siluet di rest = R |
| Jumlah node | 1200 (lebar ≥ 700) / 640; shell kedua = N / 7.5; debu 170 / 90 |
| Pudar atas / bawah | 128 px (nav) / 190 px (marquee), `destination-out` |
| Kanvas | `dpr = min(devicePixelRatio, 1.5, sqrt(3.4e6 / (W×H)))` |

Proyeksi: `k = f / (cz − z)`; titik dengan jarak < 0.28 dibuang (di belakang kamera), memudar mulus di 0.28–1.15.

---

## 5. Performa (aturan yang harus dijaga)

1. **Tidak ada alokasi per frame**: semua array scratch dibuat sekali (modul level / per layer).
2. **Edge dikelompokkan per level alpha** (10 level) → hanya ~10 `stroke()` per layer per sisi, bukan ribuan.
3. Idle **30 fps** (`ts - lastDraw >= 32`); saat scroll digambar tiap frame, dipanggil sinkron dari `paint()`
   supaya sejalan dengan balok tirai.
4. Loop berhenti bila: `p ≥ 0.97`, tab tersembunyi, atau reduced motion.
5. Tidak ada `shadowBlur`, tidak ada filter blur, tidak ada `backdrop-filter`.
6. Canvas dibatasi ~3.4 MP.

Hasil ukur (headless Chrome, 1440×900 @2×, scroll 3 detik terjadwal):

| Metrik | Hasil |
|---|---|
| Frame scroll | 180 frame, rata-rata 16.7 ms, p95 16.8 ms, 0 frame > 25 ms |
| Waktu gambar | ~1.2 ms/frame pada 400 node; di 1200 node script idle tetap ~3% |
| Main-thread idle | halaman sendiri ~8.8%; dengan globe +1.4–3 poin |
| Dengan vs tanpa globe | frame scroll identik |

**Belum diukur di GPU terintegrasi asli** dan belum dinilai "feel"-nya dengan mata di laptop PM.

---

## 6. Jebakan yang sudah pernah kena (jangan diulang)

| Masalah | Penyebab | Perbaikan |
|---|---|---|
| Balok tirai muncul di pojok kiri atas | `.lp-words { position: relative }` mengubah `offsetParent` titik; clip dihitung dari `slot.offsetLeft/Top` terhadap `.lp-p1` | Jangan memosisikan `.lp-words`/`.lp-sub`. Globe diberi `z-index: -1` di dalam `.lp-p1` yang `isolation: isolate`. |
| Globe tidak bergerak saat scroll (selalu p = 0) | React dev double-mount: instance lama sudah `destroy()` tapi `document.fonts.ready.then(remeasure)` memanggil `resize()` dan menghidupkan loop lagi | Flag `dead` di globe; semua method publik langsung return kalau `dead`. |
| Globe tertutup `background: white` saat reduced motion | `.lp-p1` punya background putih di mode ini | `isolation: isolate` + `z-index: -1` membuat canvas di atas background `.lp-p1` tapi di bawah teks. |
| Error TS `Float32Array<ArrayBufferLike>` | Inferensi `let x = new Float32Array(0)` lalu diisi hasil fungsi lain | Anotasi eksplisit `let x: Float32Array = ...`. |
| Garis menembus teks nav / marquee | Globe besar melewati tepi stage | Pudar `destination-out` atas 128 px dan bawah 190 px. |
| Inti terlihat di luar bola | Digambar di atas mesh | Urutan lapis + veil (§2.3). |

Lain-lain: canvas dirender kosong di server (opacity 0 sampai frame pertama, atribut `data-ready`), jadi tidak ada
masalah hydration. Tanpa JavaScript, halaman tetap putih seperti dulu.

---

## 7. Cara menyetel (mau lebih rapat / lebih ringan / lebih jelas)

Semua di `globe-sculpture.ts` bagian atas, kecuali yang disebut lain.

| Mau | Ubah | Catatan |
|---|---|---|
| Lebih rapat | `build(W < 700 ? 640 : 1200)` di `resize()` | Biaya naik kira-kira linear. Jaga jarak 40–50 px (§2.2). |
| Lebih renggang / ringan | turunkan angka yang sama | 800 masih cukup rapat di layar < 1280. |
| Garis lebih tipis / halus | lebar di `strokeEdges(...)` (0.62 / 0.7) | Di bawah ~0.5 px hampir hilang di DPR 1. |
| Globe lebih tegas | `A_OUT` (0.6), `A_MID` (0.55) | Naikkan pelan; di atas ~0.7 jadi berat. |
| Inti lebih jelas | `coreR` (0.5) dan alpha garis inti di `draw()`, blok "the core" | Jangan sampai terlihat di depan mesh dekat. |
| Efek "di dalam" lebih kuat | `veil` (0.28), ketebalan `A_MID` | Veil terlalu kuat → semua pucat. |
| Teks lebih bersih | kekuatan gradien `clearGrad` di `resize()` | Terlalu kuat → inti hilang. |
| Globe lebih besar / kecil | rumus `R` di `resize()` | Jaga bawahnya tidak masuk ke marquee. |
| Kamera lebih cepat/lambat | `CZ1`, kurva `u` di `draw()` | Plat penuh menutup di `p ≈ 0.9`. |
| Balok lebih/kurang bertekstur | `CELL`, `MAX_NODES`, alpha di `drawMesh` (cipher-sculpture.ts) | |

---

## 8. Checklist verifikasi

```sh
bun run typecheck   # file globe harus 0 error
bun run build       # kalau next dev sedang jalan, build di clone scratch (cp -cR), jangan di repo
```

Visual, di 1440×900 dan 390×844, di `p` = 0, 10, 25, 45, 70, 92, 100% dari `OPEN`
(`OPEN = 0.4165 × 237 / 337` dari panjang runway):

- headline dan teks kecil terbaca; "SCROLL TO OPEN" tidak tertimpa
- inti terlihat di belakang mesh dekat, bukan di depannya
- balok tirai muncul tepat di titik hitam (bukan di pojok)
- di 100% yang terlihat persis hero gelap lama (knot, tombol, teks)
- tidak ada overflow horizontal, tidak ada error console / hydration
- scroll mundur ke atas → globe tergambar lagi
- reduced motion: satu frame statis, tata letak bertumpuk

Skrip yang dipakai (puppeteer-core + Chrome sistem) ada di folder scratch sesi, bukan di repo.

---

## 9. Keterbatasan dan hal yang belum dikerjakan

- Belum diuji di GPU terintegrasi nyata; angka di §5 dari headless Chrome.
- Dokumen handoff lain **belum menyebut globe**: `HANDOFF_LANDING_REDESIGN_2026-10-13.md`, `docs/handoffburgendy.md`,
  `docs/HANDOFF_HERO_3D.md` masih menggambarkan cover tanpa globe (dan sebagian masih menyebut titik yang membesar).
  Dokumen ini adalah satu-satunya yang menjelaskan globe.
- Globe hanya hidup di cover putih. Tidak ada globe di hero gelap; transisinya dibawa oleh balok tirai.
- Inti dan shell kedua tidak ikut "dibaca" oleh teknologi bantu (canvas `aria-hidden`), memang dekoratif.
- `bun run typecheck` di repo bisa menampilkan error dari folder agen lain (`docs/remotion-web3-promo/`);
  itu bukan dari globe.
