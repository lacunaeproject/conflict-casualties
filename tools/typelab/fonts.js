/* Candidate faces for the display numerals. Shared by the in-page panel
   and the specimen page. `css` is the Google Fonts family spec; `wght`
   is a sensible starting weight for big numbers in that face. */
window.TYPELAB_FONTS = [
  { name: 'Source Serif 4', note: 'Current', kind: 'Serif', stack: '"Source Serif 4", Georgia, serif', css: null, wght: 400, track: -0.03 },
  { name: 'Fraunces', kind: 'Serif', stack: '"Fraunces", Georgia, serif', css: 'Fraunces:opsz,wght@9..144,300..800', wght: 400, track: -0.03 },
  { name: 'Newsreader', kind: 'Serif', stack: '"Newsreader", Georgia, serif', css: 'Newsreader:opsz,wght@6..72,300..800', wght: 400, track: -0.025 },
  { name: 'Instrument Serif', kind: 'Serif', stack: '"Instrument Serif", Georgia, serif', css: 'Instrument+Serif', wght: 400, track: -0.02 },
  { name: 'Playfair Display', kind: 'Serif', stack: '"Playfair Display", Georgia, serif', css: 'Playfair+Display:wght@400..900', wght: 500, track: -0.02 },
  { name: 'DM Serif Display', kind: 'Serif', stack: '"DM Serif Display", Georgia, serif', css: 'DM+Serif+Display', wght: 400, track: -0.02 },
  { name: 'Libre Caslon Display', kind: 'Serif', stack: '"Libre Caslon Display", Georgia, serif', css: 'Libre+Caslon+Display', wght: 400, track: -0.01 },
  { name: 'Source Sans 3', note: 'Already on site', kind: 'Sans', stack: '"Source Sans 3", system-ui, sans-serif', css: null, wght: 600, track: -0.035 },
  { name: 'Inter Tight', kind: 'Sans', stack: '"Inter Tight", system-ui, sans-serif', css: 'Inter+Tight:wght@300..800', wght: 500, track: -0.04 },
  { name: 'Space Grotesk', kind: 'Sans', stack: '"Space Grotesk", system-ui, sans-serif', css: 'Space+Grotesk:wght@300..700', wght: 500, track: -0.04 },
  { name: 'Bricolage Grotesque', kind: 'Sans', stack: '"Bricolage Grotesque", system-ui, sans-serif', css: 'Bricolage+Grotesque:opsz,wght@12..96,300..800', wght: 500, track: -0.04 },
  { name: 'Archivo', kind: 'Sans', stack: '"Archivo", system-ui, sans-serif', css: 'Archivo:wdth,wght@62..125,300..800', wght: 600, track: -0.03 },
  { name: 'Barlow Condensed', kind: 'Condensed', stack: '"Barlow Condensed", system-ui, sans-serif', css: 'Barlow+Condensed:wght@300;400;500;600;700', wght: 500, track: -0.01 },
  { name: 'Oswald', kind: 'Condensed', stack: '"Oswald", system-ui, sans-serif', css: 'Oswald:wght@300..700', wght: 400, track: -0.01 },
  { name: 'Big Shoulders Display', kind: 'Condensed', stack: '"Big Shoulders Display", system-ui, sans-serif', css: 'Big+Shoulders+Display:wght@300..900', wght: 600, track: 0 },
  { name: 'IBM Plex Mono', kind: 'Mono', stack: '"IBM Plex Mono", ui-monospace, monospace', css: null, wght: 400, track: -0.04 },
  { name: 'JetBrains Mono', kind: 'Mono', stack: '"JetBrains Mono", ui-monospace, monospace', css: 'JetBrains+Mono:wght@300..800', wght: 400, track: -0.05 },
];
window.TYPELAB_FONT_URL = 'https://fonts.googleapis.com/css2?' +
  window.TYPELAB_FONTS.filter(f => f.css).map(f => 'family=' + f.css).join('&') + '&display=swap';
