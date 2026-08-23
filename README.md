# Cemre'nin Evi 🏠

Yeni ev için alınacaklar listesi. Telefondan açılır, "Ana ekrana ekle" ile uygulama gibi durur.
Kartlar **Acil / Orta / Sonra / Alındı** sütunları arasında sürüklenir; her kartta görsel, fiyat, Trendyol linki ve not var. Üstte aylık bütçe çubuğu.

## Nasıl çalışır

- **Demo mod** (hiçbir ayar yapmadan): veri sadece o tarayıcıda durur. Denemek için yeterli.
- **Bulut mod** (Supabase): ikiniz de her cihazdan aynı listeyi görür ve düzenlersiniz. Değişiklikler anında öbür cihaza düşer.

## Bulut kurulumu (10 dakika, bir kere)

1. <https://supabase.com> → ücretsiz hesap aç → **New project** (isim: `ev-listesi`, bölge: Frankfurt/EU, şifreyi bir yere yaz).
2. Sol menü **SQL Editor → New query** → `supabase/schema.sql` dosyasının tamamını yapıştır → **Run**. ("Success" görmelisin.)
3. Sol menü **Project Settings → API**:
   - **Project URL** → `config.js` içindeki `SUPABASE_URL`
   - **anon public** key → `config.js` içindeki `SUPABASE_ANON_KEY`
4. Değişikliği GitHub'a gönder (aşağıda). Siteyi aç → **"Evin anahtarı?"** sorar.
   Uzun, tahmin edilemez bir kelime seç (örn. `cemre-mavi-ev-2026`) ve **iki kere** "Kapıyı aç"a bas → yeni ev kurulur, başlangıç listesi yüklenir.
5. Aynı anahtarı Cemre'ye gönder; o da telefonda bir kere yazar. Bitti.

> Anahtar nedir? Veritabanı herkese açık bir anon anahtarla konuşur; **ev anahtarı** (`x-house-key`) olmadan hiçbir satır görünmez ve yazılamaz (Postgres RLS). Gerçek bir giriş sistemi değil ama link sızsa bile listeyi korur. Anahtarı ⚙ Ayarlar'dan görebilir / değiştirebilirsiniz.

## Yayınlama (GitHub Pages)

```powershell
cd "ev-listesi"
git add -A
git commit -m "güncelleme"
git push
```

Birkaç saniye sonra site güncellenir: **https://ahmetresulkilinc.github.io/ev-listesi/**

Telefonda: linki aç → Safari'de **Paylaş → Ana Ekrana Ekle** (Android Chrome: menü → **Ana ekrana ekle**).

## Yerelde deneme

```powershell
cd "ev-listesi"
python -m http.server 8080
```
Tarayıcıda `http://localhost:8080`. (Telefonla denemek için aynı Wi-Fi'dan `http://<PC-IP>:8080`.)

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html` / `style.css` / `app.js` | uygulama |
| `config.js` | Supabase URL + anon key (boşsa demo mod) |
| `seed.js` | başlangıç listesi (WhatsApp + Trendyol sepeti) |
| `supabase/schema.sql` | tablolar + RLS |
| `manifest.webmanifest`, `sw.js`, `icons/` | "Ana ekrana ekle" + offline kabuk |
| `buddies.js`, `buddies-data.js`, `buddies/*.json` | sayfanın altında yaşayan pixel karakterler (tutup fırlat, dokun → kalp) |
| `tools/make-icons.js` | ikonları yeniden üretir (`node tools/make-icons.js`) |
| `tools/render-sprite.js` | bir karakter JSON'unu PNG'ye çizer (önizleme) |
| `tools/bundle-buddies.js` | `buddies/*.json` → `buddies-data.js` |

## Karakterler (buddy'ler)

Altta dolaşan karakterler `buddies/<id>.json` dosyalarından gelir (`palette` + 2 `frames`; `.` şeffaf). Yeni karakter eklemek için bir JSON yaz, `node tools/render-sprite.js buddies/yeni.json onizleme.png 10` ile bak, sonra `node tools/bundle-buddies.js ayi,hayalet,flork,top,kedi,tavsan,yeni` ile paketle ve push et.

- Basılı tutup sürükle → bırakınca fırlar, yere düşer, seker.
- Dokun → zıplar, kalp saçar, bir şey söyler.
- Bir ürün "Alındı" olunca hepsi birlikte zıplar.

## Trendyol favorilerini aktarma

Ahmet'in PC'sinde (Türkiye internetiyle) çalışır:

```powershell
cd "ev-listesi"
node tools/import-trendyol.js "https://ty.gl/KOLEKSIYON-LINKI" "EV-ANAHTARI" sonra
```

- Koleksiyon ya da tek ürün linki verilebilir; isim + görsel + fiyat + link otomatik gelir.
- Zaten listede olan isimler atlanır. Önce denemek için sona `--dry` ekle.
- Not: Trendyol koleksiyonun sadece ilk ~10 ürününü dışarı verir; eksik kalanları ürün linkiyle tek tek ekleyebilirsin.

## Kartta linkler ve otomatik doldurma

- Bir kart bir eşyadır ("Puf"), altına **birden fazla model** bağlanır ("+ link ekle"):
  her model kendi linki/adı/görseli/fiyatıyla saklanır. Kartta "🛍️ N model" rozetine
  basınca modeller kartın altında sıralanır; her satır Trendyol'a gider.
- Koleksiyondaki çeşitleri tek karta toplamak için: `node tools/import-trendyol.js "<link>" "<anahtar>" orta --kart "Puf"`
- Yeni kartta Trendyol linki girilince site adı/görseli/fiyatı otomatik çekmeyi dener
  (Trendyol bazen dışarıya kapalı — o zaman ipucu gösterir). Gelen görsel beğenilmezse
  "Kaldır" deyip fotoğraf seçilebilir ya da 📋 ile panodan yapıştırılır.
- Telefonda: Trendyol'da ürüne **Paylaş → Kopyala**, sitede **+ → 📋 Panodan yapıştır** —
  link (ve paylaşımdaki ad) forma dolar. Android'de siteyi "Ana ekrana ekle" yaptıysan
  Trendyol'dan doğrudan **Paylaş → Evim**'e de gönderebilirsin.

## Yedek

⚙ Ayarlar → **Yedek indir** bir JSON verir; **Yedek yükle** ile geri alınır. Bulut modunda zaten Supabase'de durur.
