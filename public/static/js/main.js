const hamburger = document.getElementById('hamburger');
    const nav = document.getElementById('nav');
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('show');
    });
  
    let lastScrollTop = 0;
    const navbar = document.querySelector("header");
    window.addEventListener("scroll", function () {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollTop > lastScrollTop && scrollTop > 100) {
        navbar.classList.add("hide");
      } else {
        navbar.classList.remove("hide");
      }
      lastScrollTop = scrollTop;
    });
  
    // Preload helper
    function preloadImages(images, callback) {
      let loaded = 0;
      const total = images.length;
      if (total === 0) return callback();
  
      images.forEach(src => {
        const img = new Image();
        img.onload = img.onerror = () => {
          loaded++;
          if (loaded === total) callback();
        };
        img.src = src;
      });
    }
  
    // Main load logic
    fetch('/api/images')
      .then(res => res.json())
      .then(images => {
        const heroImg = document.querySelector(".hero-img");
        const heroImages = images.filter(img => img.section === "hero");
  
        // === Hero Slideshow
        if (heroImages.length > 0 && heroImg) {
          let index = 0;
          function showSlide() {
            heroImg.classList.remove("show");
            setTimeout(() => {
              heroImg.src = heroImages[index].url;
              heroImg.onload = () => heroImg.classList.add("show");
              index = (index + 1) % heroImages.length;
            }, 300);
          }
          showSlide();
          setInterval(showSlide, 5000);
        }
  
        // === Preload ALL image URLs
        const allImageUrls = images.map(img => img.url);
        preloadImages(allImageUrls, () => {
            const loader = document.getElementById("loader");
            const siteWrapper = document.getElementById("site-wrapper");
            
            if (loader) loader.style.display = "none";
            if (siteWrapper) siteWrapper.style.display = "block";
        });
      })
      .catch(err => {
        console.error("Failed to load images:", err);
      });
  
    // === Language switcher (NEW LOGIC)
    const langSwitchers = document.querySelectorAll('.lang-switch');
    const langOptions = document.querySelectorAll('.lang-option');
    let currentLang = localStorage.getItem('lang') || 'lt';
  
    function setActiveLang(lang) {
      langOptions.forEach(el => {
        el.classList.toggle('active', el.dataset.lang === lang);
      });
    }
  
    function loadLang(lang) {
      fetch(`/static/lang/${lang}.json`)
        .then(res => res.json())
        .then(data => {
          document.querySelectorAll('[data-i18n]').forEach(el => {
            const keys = el.dataset.i18n.split('.');
            let value = data;
            keys.forEach(k => value = value?.[k]);
            if (value) el.textContent = value;
          });
        });
    }
  
    langSwitchers.forEach(switcher => {
      switcher.addEventListener('click', (e) => {
        const selected = e.target.dataset.lang;
        if (!selected) return;
  
        currentLang = selected;
        localStorage.setItem('lang', currentLang);
        loadLang(currentLang);
        setActiveLang(currentLang);
      });
    });
  
    setActiveLang(currentLang);
    loadLang(currentLang);