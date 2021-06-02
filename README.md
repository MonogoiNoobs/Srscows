<p align="center">
  ●以下URLをクリック！●<br>
  <a href="https://monogoinoobs.github.io/Srscows/">https://monogoinoobs.github.io/Srscows/</a>
</p>

# 必要なもの
* Google Chrome
* OBS Studio
  * [obs-websocket プラグイン](https://github.com/Palakis/obs-websocket)

# 使い方
1. OBS の WebSockets サーバーを有効にする。
2. ソースに新しくテキストを新規作成し、そのときに付けた名前を控えておく。
3. フォームに必要事項を記入する。このとき、「字幕ソース」に先ほど控えたテキストの名前を入力する。
4. 「接続」をクリックする。
5. マイクの使用を許可する。
6. しゃべる。

# 翻訳
GAS で以下のスクリプトをウェブアプリとしてデプロイし、入手したデプロイ ID をフォームに入力する。
詳しくは[本家のサイト](http://www.sayonari.com/trans_asr/asr.html)を参照。
```javascript
function doGet(e) {
  var p = e.parameter;
  var translatedText = LanguageApp.translate(p.text, p.source, p.target);
  return ContentService.createTextOutput(translatedText);
}
```

# ライセンス
GPL-2.0
