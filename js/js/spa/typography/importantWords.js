// Standalone important-word fluctuation effect for SPA
// Can be reused by both old pages and the SPA without double-initializing.
// Attaches to window.__SPA_ImportantWords

(function () {
  var fontVariants = [
    { weight: 400, style: 'normal' },
    { weight: 500, style: 'normal' },
    { weight: 600, style: 'normal' },
    { weight: 700, style: 'normal' },
    { weight: 800, style: 'normal' },
    { weight: 400, style: 'italic' },
    { weight: 500, style: 'italic' },
    { weight: 600, style: 'italic' }
  ];

  var allLetterSpans = [];
  var cyclingStarted = false;

  function initImportantWords(root) {
    root = root || document;
    var importantWords = root.querySelectorAll('.important-word');

    importantWords.forEach(function (el) {
      if (el.dataset.fluctuateInit) return;
      el.dataset.fluctuateInit = 'true';

      var text = el.textContent;
      el.textContent = '';
      var letterSpansInWord = [];

      Array.from(text).forEach(function (char, index) {
        if (char === ' ') {
          el.appendChild(document.createTextNode(' '));
        } else {
          var span = document.createElement('span');
          span.textContent = char;
          span.className = 'important-word-letter wavy-text-letter';
          span.dataset.originalColor = '';
          span.dataset.letterIndex = index;

          var fluctuateDelay = (Math.random() * 2).toFixed(2);
          var wavyDelay = (index * 0.08).toFixed(2);
          span.style.animationDelay = fluctuateDelay + 's, ' + wavyDelay + 's';

          var variant = fontVariants[Math.floor(Math.random() * fontVariants.length)];
          span.style.fontWeight = variant.weight;
          span.style.fontStyle = variant.style;

          el.appendChild(span);
          allLetterSpans.push(span);
          letterSpansInWord.push(span);
        }
      });

      el._letterSpans = letterSpansInWord;
    });

    startCycling();
  }

  function startCycling() {
    if (cyclingStarted) return;
    cyclingStarted = true;

    // Normal speed: change ~15% of letters every 400ms
    setInterval(function () {
      if (allLetterSpans.length === 0) return;
      var numToChange = Math.max(1, Math.floor(allLetterSpans.length * 0.15));
      for (var i = 0; i < numToChange; i++) {
        var randomSpan = allLetterSpans[Math.floor(Math.random() * allLetterSpans.length)];
        var variant = fontVariants[Math.floor(Math.random() * fontVariants.length)];
        randomSpan.style.fontWeight = variant.weight;
        randomSpan.style.fontStyle = variant.style;
      }
    }, 400);
  }

  window.__SPA_ImportantWords = {
    init: initImportantWords,
    fontVariants: fontVariants
  };
}());
