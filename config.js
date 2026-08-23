// Supabase bağlantı bilgileri.
// Boş bırakılırsa site "demo modda" çalışır: veri sadece bu tarayıcıda saklanır.
// Doldurmak için: Supabase Dashboard > Project Settings > Data API
//   Project URL      -> SUPABASE_URL
//   anon public key  -> SUPABASE_ANON_KEY
window.EV_CONFIG = {
  SUPABASE_URL: "https://tfsjzvltwmbmvjfoxmkn.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmc2p6dmx0d21ibXZqZm94bWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Njc5NzYsImV4cCI6MjEwMzA0Mzk3Nn0.GYmK82MH6PO-S-OHg0R3qDZ2a5l7MsGWKtlw2n4BGSw",
};

// Hoş geldin mesajı: ev anahtarı ilk kez girildiğinde bir kere gösterilir (cihaz başına).
// Metni istediğin gibi değiştir; satır atlamak için \n kullan. text boşsa gösterilmez.
window.EV_WELCOME = {
  title: "Hoş geldin Cemre ♥",
  text: "Bu listeyi senin için yaptım.\nAcil olanları hemen, kalanını ay ay birlikte tamamlarız.\nAşağıdaki ponçikler sana eşlik edecek — canın sıkılınca birini fırlat.\nEvin güzel olacak; çünkü içinde sen olacaksın.",
  sign: "— Ahmet",
  button: "Eve gir ♥",
};
