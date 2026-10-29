// Goal: 팝오버·시트는 body로 포털되어 body 글꼴을 물려받으므로, 기준 이미지에 브라우저 기본 serif가 찍히지 않게 body 글꼴을 정함 (계약 §4)
const VISUAL_FONT_FAMILY = 'sans-serif';

document.body.style.setProperty('font-family', VISUAL_FONT_FAMILY);
