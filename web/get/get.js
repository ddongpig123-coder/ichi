// https://ichi-6b8f7.web.app/get — スマホの種類を見て、そのままストアへ移動する
// （ボタンはページに残すので、自動で移動しなかったときも押せば行ける）
(function () {
  var APP_STORE = "https://apps.apple.com/jp/app/id6825671804";
  var PLAY = "https://play.google.com/store/apps/details?id=jp.timetable.app";
  var ua = navigator.userAgent || "";
  // iPadOS は Mac と同じ UA を名乗るので、タッチ対応かどうかで見分ける
  var ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  var android = /android/i.test(ua);
  var status = document.getElementById("status");

  if (android) {
    // Android は Google Play を上の大きいボタンに入れ替える
    document.body.className = "android";
    document.getElementById("android").className = "btn primary android-btn";
    document.getElementById("ios").className = "btn secondary ios-btn";
  }

  var target = ios ? APP_STORE : android ? PLAY : null;
  if (!target) return; // PC など: 両方のボタンを見せるだけ
  if (status) status.textContent = ios ? "App Storeを開いています…" : "Google Playを開いています…";
  window.location.replace(target);
})();
