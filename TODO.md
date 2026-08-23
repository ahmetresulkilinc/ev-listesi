# Kaldığımız yer — 23 Ağustos 2026

## Şu an canlı (https://ahmetresulkilinc.github.io/ev-listesi/)
- "Yastık Pixel" görünüm (yumuşak köşeler, renkli dudak gölgeler, pixel font/sprite korunuyor) — commit `b683655`.
- 6 buddy (ayı, hayalet, flork, top, kedi, tavşan): altta dururlar, ara sıra zıplar/yürür, göz kırparlar; dokun → zıplar + kalp + laf; basılı tut/yana çek → kaldır, fırlat, yere düşer, seker; ürün "Alındı" olunca hepsi zıplar. Telefonda 4'ü görünür (ayı hep var, diğerleri güne göre döner), masaüstünde 6'sı.
- Testler: scratchpad `pp/test.js` (22/22) ve `pp/test-buddies.js` (13/13) geçiyor.
- Bekleyen: Supabase kurulumu (README), ayrıca yarım kalan bir otomatik inceleme turu vardı — durduruldu, bulgu alınmadı.

## Ahmet'in istediği sonraki özellikler (henüz YAPILMADI — "sonra söylediğimde")
1. **Kendi kafalarına göre dolaşsınlar**: daha zengin idle davranışı — rastgele yürüyüş rotaları, durup etrafa bakma, birbirini ziyaret etme, yan yana oturma, uyuma/uyanma.
2. **Bir şeylerle etkileşime girsinler**: sütunların/kartların üstüne tırmanma veya tünemesi, FAB'ı kurcalama, bütçe barına bakma, "Alındı" olunca o karta koşup kutlama, birbiriyle etkileşim (kalp alışverişi, itişme, kovalamaca).
3. **Efektleri iyi ayarla**: kalp/toz/parıltı parçacıkları, iniş toz bulutu, squash-stretch zamanlamaları, ses değil ama titreşim dozları; balon yazıları daha karakterli.
4. **Yürüme animasyonu + tepkiler**: her karakter için yürüme kareleri (2–4 frame), dönüş, düşme/çarpma kareleri, tutulunca korkma/sevinme yüzü, tap tepkilerinin çeşitlenmesi.
5. **Yeni karakter**: Ahmet'in eklediği ekran görüntüsü `Ekran görüntüsü 2026-08-23 113414.png` — pembe saçlı (mohawk), gri-mavi tüylü, somurtkan/komik kedicik (Bibble tarzı). `buddies/bibble.json` olarak çizilecek, `tools/bundle-buddies.js` listesine eklenecek.

## Nasıl devam edilir
- Sprite çizimi: `node tools/render-sprite.js buddies/<id>.json onizleme.png 10` ile bak; paket: `node tools/bundle-buddies.js ayi,hayalet,flork,top,kedi,tavsan,bibble`.
- Yürüme kareleri için `frames` dizisine frame 2-3 eklenebilir; `buddies.js` şu an 2 frame varsayar (0 idle, 1 kırpma/mutlu) — frame rolleri (`idle/blink/walk1/walk2/held/land`) için küçük bir şema eklenmeli.
- Yerel test: `python -m http.server 8080` (proje kökünde) → `node pp/test.js` / `node pp/test-buddies.js` (scratchpad).
