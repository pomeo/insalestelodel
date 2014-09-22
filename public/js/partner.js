$(function() {
  var results = new RegExp('[\?&]partner=([^&#]*)').exec(window.location.href);
  if (results !== null) {
    if ($.cookie('partner') == undefined) {
      $.get('http://localhost:3000/unique/' + results[1]);
      $.cookie('partner', results[1], { expires: 180, path: '/' });
    } else {
      $.get('http://localhost:3000/unique/' + $.cookie('partner'));
    }
  }
});