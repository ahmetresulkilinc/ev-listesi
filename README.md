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
| `tools/make-icons.js` | ikonları yeniden üretir (`node tools/make-icons.js`) |

## Yedek

⚙ Ayarlar → **Yedek indir** bir JSON verir; **Yedek yükle** ile geri alınır. Bulut modunda zaten Supabase'de durur.
