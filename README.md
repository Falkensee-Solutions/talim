# Talim · Fatiha ve Fil

Çocuklar için deneysel dinleme ve ezber çalışması.

Ana sayfa mevcut surelerin sade listesidir: Fatiha (1) ve Fil (105). Her surede yalnızca **Dinle** ve **Ezberle** bulunur. Dinle mevcut dinleme alanını açar; Ezberle listeden ayrılmadan ayar penceresini açar ve onaylanınca ezber alanına geçer. Sureler bağlantısı veya Talim logosu listeye döndürür ve oynatmayı durdurur. Tarayıcının geri/ileri düğmeleri desteklenir; `#dinle` dinleme alanını, `#ezber` ise aktif ezber oturumunu veya yeni oturum ayarlarını açar. Mevcut içerik ve eşleşme kayıtları korunur; öğrenci ilerlemesi kaydedilmez.

- Fil Suresi `105.mp3` kaydıyla dinlenir ve tam/ayet/kısa grup/kelime modlarında ezberlenir. `?surah=105` seçili sureyi belirler. Fil için 27 kelime aralığı yalnızca yerel WhisperX hizalamasıyla hazırlanmıştır; otomatik zamanlar öğretmen tarafından doğrulanmış harf/tecvid zamanları değildir. Kayıt Besmele ile başlar; Besmele ayrı başlangıç bölümüdür ve 5 ayetin dışında tutulur. Orta Fil adımları ikişer tam kelimeden oluşur. Fatiha ve Fil sesleri, kaynakları ve zamanlama kayıtları ayrıdır.
- Ayetleri seçerek dinleme ve sürekli tekrar. Üstteki numara düğmelerinden veya ayet yanındaki düğmelerden aynı dinleme seçimi değiştirilebilir.
- Dinle ekranında Sureyi ezberle düğmesinin yanındaki Hafız açılır menüsü ve Ezberle → İnce ayarlar hafız seçimi aynı kaydı değiştirir. Açılır menü uygulamanın yeşil/beyaz düğme stilini kullanır; işletim sisteminin yerel seçim penceresi açılmaz. Klavyede ok tuşlarıyla seçenekler gezilir, Enter/Boşluk ile seçilir, Escape ile kapatılır. Fatiha’nın ikinci kaydı `001_2.mp3`, Hafız 2 AA adıyla sunulur. Hafız değişince çalma/ezber oturumu durur; o kaydın ses kimliği, kelime zamanları, sessizlikleri ve ayrı öğretmen eşleşmeleri yüklenir. İlk kaydın zamanları ikinciye uygulanmaz. İkinci kayıt için 34 kelime zaman aralığı WhisperX ile yalnızca yerel olarak üretilmiştir; ayet/kelime çalışması kullanılabilir, fakat bu aralıklar öğretmen tarafından doğrulanmış harf/tecvid zamanları değildir. ASR, referans ve ham hizalama yanıtları `data/alignment-local-001-2-aligned/` altında korunur; ham tanılama dosyaları web yayınına alınmaz.
- Ezber ayetleri dinleme seçiminden bağımsızdır. Ezber ekranı her açıldığında tüm ayetler seçilir; eşit boyutlu, yalnızca numara gösteren düğmeler 7 sütunlu satırlara yerleşir. Başlığın sağındaki Hiçbirini seçme / Hepsini seç düğmesi toplu seçimi değiştirir; önündeki kare tüm ayetler seçiliyken dolu, diğer durumlarda boştur.
- Tam, ayet ayet, orta adımlar ve kelime kelime çalışma. Kısa grup/adım seçimleri Arapça okuma yönüne göre sağdan sola dizilir; satırlar yukarıdan aşağıya devam eder. Ses ve adım sırası değişmez.
- Hoca bir kez okur; öğrenci 1, 3, 5 veya 7 kez sessiz tekrar eder.
- Ezber ekranındaki İnce ayarlar: tekrar sayısı (varsayılan 3), tekrar arası (0,5; 1; 1,5; 2; 3; 4; 5 saniye, varsayılan 1,5), ayet/adım geçişi (Otomatik/Manuel, varsayılan Otomatik) ve hafız seçimi (Fatiha: Hafız 1 / Hafız 2 AA). Hepsi yan yana seçim düğmeleriyle gösterilir. Saniye düğmeleri eşit boyutludur; birim yalnızca başlıktadır.
- Tekrar sırasında görsel takip; hoca/öğrenci ikonları ve açıklama metinleri gösterilmez. Normal dinlemedeki hazırlık süresi de varsayılan 1,5 saniyedir.
- Tekrar arası bekleme, kum saatinin yanında 160 px uzunluğunda ve tekrar sayaçları gibi 27 px yüksekliğinde, yuvarlatılmış sarı doluluk göstergesiyle gösterilir. Görünür saniye/sayı yazısı yoktur; doluluk seçilen süre boyunca kesintisiz azalır.
- Tekrar başlamadan 0,1 saniye önce kırmızı ok ilk konumunda görünür ve başlangıca kadar sabit kalır. Bu görsel hazırlık mevcut beklemenin son 0,1 saniyesinde gerçekleşir; tekrarın başlangıcı, ses zamanları ve ilerleme hızı değişmez.
- Ezber adımı etiketi ve tekrar sayacı aynı satırda gösterilir; etiket 16 px, sayaç rakamları 14 px boyutundadır.
- Ezberden çıkış düğmesi sure başlığının yanındadır. Otomatik geçişte tekrarlar tamamlanınca seçili bekleme süresinin ardından sonraki ayet/adım başlar; son bölümde tur biter. Manuel geçişte oynatıcının en altındaki düğme tekrarlar bitene kadar gri ve basılamaz, tamamlanınca etkinleşir. Tam modunda bölüm geçişi yoktur.
- Sağ üstteki görünüm ayarları: Türkçe okunuş, takip işareti ve kaynak/lisans bilgisi.
- Alt açıklama ve footer gösterilmez; oynatma durumu yalnızca ekran okuyuculara duyurulur.
- Ayet numaraları yalnızca yandaki seçim düğmelerinde gösterilir; düğmeler Arapça metin alanının altına hizalanır ve Türkçe okunuş alanına girmez. Eûzü başlangıcı ortası noktalı, sekiz yapraklı ayet süsüne benzeyen bir SVG simgesiyle işaretlenir.
- Ayet alanları düz köşelidir; solda seçim çizgisi yoktur. Alanlar arasında ortalanmış, %90 genişliğinde ince bir alt çizgi bulunur; son alanın altında çizgi gösterilmez.
- Arapça metin Açık Kuran’daki Shaikh Hamdullah Mushaf yazı tipiyle gösterilir: harfler ve noktaları siyah, harekeler ve şedde kırmızı, durak işaretleri mor. Metin ve ses eşleşme konumları değiştirilmez.

### Arapça yazı tipi

`TalimQuran.ttf`, [Açık Kuran](https://acikkuran.com/1) tarafından kullanılan **Shaikh Hamdullah Mushaf** (Muhammet Abay, 2011) yazı tipinin Talim Hamdullah adlı renkli görünüm sürümüdür. Proje sahibi kullanım ve siteyle dağıtım iznini doğrulamıştır; fontun genel bir açık lisansa sahip olduğu iddia edilmez. Kaynak, özgün dosyanın SHA-256 özeti ve telif bilgisi `Hamdullah-NOTICE.txt` içinde korunur ve Ayarlar’dan açılır.

Glif şekilleri, karakter eşleştirmeleri, GPOS hareke yerleşimleri ve GSUB harf birleşimleri değiştirilmez. Eklenen COLR/CPAL katmanları yalnızca harekeleri (bağlama göre kullanılan alternatifleriyle birlikte) `#B42332`, durakları `#7D3C98` yapar. Harflerin kendi noktaları siyah kalır. Yazı tipi yerel dosyadan sunulur; harici yazı tipi servisine istek yapılmaz.

**Deneme sürümüdür.** Takip işareti yaklaşık zamanlamalar kullanır; harf/tecvid
uygunluğu veya çocuğun okuması otomatik değerlendirilmez. Mikrofon kullanılmaz.
Öğretmen kontrolü önerilir. Öğrencinin sesi ve öğrenme ilerlemesi kaydedilmez.

Med ve şedde işaretleri, mevcut görsel dağılıma küçük oransal ipuçları ekler;
kelime sınırları ve özel son-kelime hizalaması değişmez. Kırmızı işaret düz üst
kenarlı bir trapezdir. [Kaynaklar, kapsam ve zamanlama sınırları](TAJWEED-TIMING.md).

## Yerel kullanım

Node.js 20 veya üzeri gerekir; ek npm bağımlılığı yoktur.

```bash
npm start
npm test
npm run build
```

Yerel adres: `http://127.0.0.1:4173/`. Statik web çıktısı `dist/` klasörüne yazılır.
Yalnızca uygulamanın gereken dosyaları ve hazır zamanlamalar çıktıya alınır;
model çağrısı veya yeni ses işleme yapılmaz.

GitHub Pages, GitHub Actions iş akışıyla yayımlanır. İş akışı Ubuntu 24.04'e
sabitlenmiştir; `checkout@v6` ve `setup-node@v6` Node.js 24 eylem çalışma zamanını
kullanır. Pages adımları `configure-pages@v6`, `upload-pages-artifact@v5` ve
`deploy-pages@v5` sürümlerindedir. Projenin test/build adımları için seçilen Node.js
sürümü 22 olarak korunur.
Derleme ve testlerin temiz checkout'ta çalışması için her sure/hafızın hazır
zamanlama, kelime adayı ve sessizlik girdileri Git'e dahildir. Yerel ASR ve
diagnostik klasörlerin tamamı değil, yalnızca gereken oynatma girdileri izlenir.
Pages sürümü salt okunurdur:
Node API sunucusu, anahtarlar, sanal ortam ve yerel ASR/diagnostik yanıtları
web sitesine dahil edilmez. Ses, statik yayında tarayıcı içi Blob üzerinden çalınır;
böylece sunucunun byte-range desteğinden bağımsız olarak seçilen ayete geçilebilir.
Elle eşleştirme aracı korunmuştur ama görünmezdir;
statik yayından içerik dosyaları sunucuya kaydedilemez.

## Kaynaklar ve kullanım hakları

Arapça metin ve Türkçe okunuş: Açık Kuran’ın [Fatiha](https://acikkuran.com/fatiha-suresi.md) ve [Fil](https://acikkuran.com/fil-suresi.md) sayfaları,
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.tr).
Kaynak atfı arayüzde korunur; ticari kullanım ve yeniden dağıtımda lisans koşullarına
uyulmalıdır. Bu depo, metin veya ses için genel bir MIT lisansı vermez.

Ses kaydı, kayıt sahibinin açık yayımlama onayıyla bu test sürümüne dahil edilmiştir.
Kaydın okuyucusu hakkında ayrıca doğrulanmamış bir isim/kimlik iddiası eklenmemiştir.
