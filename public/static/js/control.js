// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    localStorage.setItem('activeTab', tab.dataset.tab);
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// Restore last tab
const lastTab = localStorage.getItem('activeTab');
if (lastTab) {
  document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${lastTab}"]`)?.classList.add('active');
  document.getElementById(lastTab)?.classList.add('active');
}

// Load Hero images
fetch('/api/images')
  .then(res => res.json())
  .then(images => {
    const heroContainer = document.getElementById('heroContainer');
    heroContainer.innerHTML = '';
    const heroImages = images.filter(img => img.section === 'hero');

    heroImages.forEach((img, i) => {
      const entry = document.createElement('div');
      entry.className = 'image-entry';
      entry.innerHTML = `
      <img src="${img.url}" />
   <span>
  ${img.text_lt || ''}<br/>
  ${img.text_en || ''}
</span>

 <form action="/delete" method="POST">
  <input type="hidden" name="index" value="${i}" />
  <input type="hidden" name="section" value="hero" />
  <button>Delete</button>
</form>

    `;
    
      heroContainer.appendChild(entry);
    });

  });

function editHero(index) {
  document.getElementById('editHeroIndex').value = index;
}

// Load Works page
fetch('/api/images')
  .then(res => res.json())
  .then(images => {
    const container = document.getElementById('worksContainer');
    container.innerHTML = '';
    images.forEach((img, i) => {
      if (img.section !== 'works') return;
      const entry = document.createElement('div');
      entry.className = 'image-entry';
      entry.innerHTML = `
      <img src="${img.url}" />
      <span>
        <b>LT:</b> ${img.text_lt || ''}<br/>
        <b>EN:</b> ${img.text_en || ''}
      </span>
    <form action="/delete" method="POST">
  <input type="hidden" name="index" value="${i}" />
  <input type="hidden" name="section" value="works" />
  <button>Delete</button>
</form>

      <button class="edit-works-btn" data-index="${i}" data-entry='${JSON.stringify(img).replace(/'/g, "&apos;")}'>Edit</button>
    `;
    
      container.appendChild(entry);
    });
    document.querySelectorAll('.edit-works-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const index = parseInt(btn.dataset.index);
    const data = JSON.parse(btn.dataset.entry.replace(/&apos;/g, "'"));
    editWorks(index, data);
  });
});
  });


function editWorks(index, data) {
  const oldPreview = document.getElementById('existingExtraImagesWrapper');
  if (oldPreview) oldPreview.remove();

  document.getElementById('editWorksIndex').value = index;
  const form = document.querySelector('#worksForm');

  form.querySelector('textarea[name="text_lt"]').value = data.text_lt || '';
  form.querySelector('textarea[name="text_en"]').value = data.text_en || '';
  form.querySelector('textarea[name="fulltext_lt"]').value = data.fulltext?.lt || '';
  form.querySelector('textarea[name="fulltext_en"]').value = data.fulltext?.en || '';

  const imagePreview = document.createElement('img');
  imagePreview.src = data.url;
  imagePreview.style.maxHeight = '100px';
  form.querySelector('input[name="image"]').insertAdjacentElement('afterend', imagePreview);

  if (Array.isArray(data.extraImages)) {
    const extraWrapper = document.createElement('div');
    extraWrapper.id = 'existingExtraImagesWrapper';

    data.extraImages.forEach((url, i) => {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.gap = '10px';
      container.style.marginBottom = '8px';

      let media;
      if (url.match(/\.(mp4|webm|ogg)$/)) {
        media = document.createElement('video');
        media.setAttribute('src', url);
        media.setAttribute('muted', '');
        media.setAttribute('autoplay', '');
        media.setAttribute('loop', '');
        media.setAttribute('playsinline', '');
        media.removeAttribute('controls'); // double sure
        media.style.cursor = 'zoom-in';
        media.addEventListener('click', () => zoomMedia(url));
        
        // some browsers ignore autoplay unless loaded explicitly
        media.load();
        
      } else {
        media = document.createElement('img');
        media.src = url;
        media.style.cursor = 'zoom-in';
        media.addEventListener('click', () => zoomMedia(url));
      }
      media.style.height = '60px';
      media.style.borderRadius = '4px';
      media.style.objectFit = 'cover';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'existingExtraImages';
      input.value = url;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '🗑️ Remove';
      btn.style.backgroundColor = '#c00';
      btn.style.color = 'white';
      btn.style.border = 'none';
      btn.style.padding = '4px 8px';
      btn.style.borderRadius = '4px';
      btn.style.cursor = 'pointer';

      btn.addEventListener('click', () => {
        container.remove();
      });

      container.appendChild(media);
      container.appendChild(input);
      container.appendChild(btn);
      extraWrapper.appendChild(container);
    });

    form.querySelector('input[name="extraImages"]').insertAdjacentElement('afterend', extraWrapper);
  }
}

// Load Contact images
fetch('/api/images')
  .then(res => res.json())
  .then(images => {
    const container = document.getElementById('contactContainer');
    container.innerHTML = '';
    const contactImages = images.filter(img => img.section === 'contact');

    contactImages.forEach((img, i) => {
      const entry = document.createElement('div');
      entry.className = 'image-entry';
      entry.style.display = 'flex';
      entry.style.alignItems = 'center';
      entry.style.justifyContent = 'flex-start';
      entry.style.gap = '16px';
    
      const caption = i === 0 ? 'Top Image' : 'Bottom Image';
    
      entry.innerHTML = `
        <img src="${img.url}" style="max-height: 100px; border-radius: 4px;" />
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-weight: bold;">${caption}</span>
          <form action="/delete" method="POST">
          <input type="hidden" name="section" value="contact" />
            <input type="hidden" name="index" value="${i}" />
            <button>Delete</button>
          </form>
        </div>
      `;
      container.appendChild(entry);
    });
    
  });

// Load About section
fetch('/api/about')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('aboutContainer');
    container.innerHTML = '';
    data.forEach((item, i) => {
      const entry = document.createElement('div');
      entry.className = 'image-entry';
      entry.innerHTML = `
        <img src="${item.image}" />
        <span>
          <b>${item.title}</b><br/>
          <b>LT:</b> ${item.text_lt || ''}<br/>
          <b>EN:</b> ${item.text_en || ''}
        </span>
        <form action="/deleteAbout" method="POST">
          <input type="hidden" name="index" value="${i}" />
          <button>Delete</button>
        </form>
<button class="edit-about-btn" data-index="${i}" data-entry='${JSON.stringify(item).replace(/'/g, "&apos;")}'>Edit</button>
      `;
      container.appendChild(entry);
    });
    document.querySelectorAll('.edit-about-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        const data = JSON.parse(btn.dataset.entry.replace(/&apos;/g, "'"));
        editAbout(index, data);
      });
    });
    
  });

function editAbout(index, data) {
  document.getElementById('editAboutIndex').value = index;
  document.querySelector('#aboutForm input[name="title"]').value = data.title || '';
  document.querySelector('#aboutForm textarea[name="text_lt"]').value = data.text_lt || '';
  document.querySelector('#aboutForm textarea[name="text_en"]').value = data.text_en || '';
}
function zoomMedia(url) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0, 0, 0, 0.85)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = 9999;
  overlay.style.cursor = 'zoom-out';

  const media = url.match(/\.(mp4|webm|ogg)$/)
    ? document.createElement('video')
    : document.createElement('img');

  media.src = url;
  media.style.maxWidth = '90vw';
  media.style.maxHeight = '90vh';
  media.style.borderRadius = '8px';
  media.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';

  if (media.tagName === 'VIDEO') {
    media.controls = true;
    media.autoplay = true;
  }

  overlay.appendChild(media);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', () => overlay.remove());
}

window.editWorks = editWorks;
window.editAbout = editAbout;