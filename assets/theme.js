/* ============================================================
   CYCL Theme — Vanilla JS
   ============================================================ */

'use strict';

// ---- Utility helpers --------------------------------------------------------

function money(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: window.Shopify?.currency?.active || 'USD',
    minimumFractionDigits: 2
  });
}

function qs(selector, scope) {
  return (scope || document).querySelector(selector);
}

function qsa(selector, scope) {
  return Array.from((scope || document).querySelectorAll(selector));
}

// ---- Announcement Bar -------------------------------------------------------

(function initAnnouncementBar() {
  const bar = qs('.announcement-bar');
  if (!bar) return;
  const closeBtn = qs('.announcement-bar__close', bar);
  const key = 'announcement-dismissed-' + (bar.dataset.id || 'default');

  if (sessionStorage.getItem(key)) {
    bar.style.display = 'none';
    return;
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      bar.style.maxHeight = bar.offsetHeight + 'px';
      requestAnimationFrame(() => {
        bar.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
        bar.style.maxHeight = '0';
        bar.style.opacity = '0';
        bar.style.overflow = 'hidden';
      });
      setTimeout(() => bar.remove(), 350);
      sessionStorage.setItem(key, '1');
    });
  }
})();

// ---- Mobile Nav -------------------------------------------------------------

(function initMobileNav() {
  const toggle = qs('.menu-toggle');
  const nav = qs('.mobile-nav');
  const overlay = qs('.mobile-nav-overlay');
  if (!toggle || !nav) return;

  function open() {
    toggle.classList.add('is-open');
    nav.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    toggle.setAttribute('aria-expanded', 'true');
  }

  function close() {
    toggle.classList.remove('is-open');
    nav.classList.remove('is-open');
    document.body.style.overflow = '';
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    toggle.classList.contains('is-open') ? close() : open();
  });

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // Close on overlay click
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
      close();
    }
  });
})();

// ---- Cart Drawer ------------------------------------------------------------

const CartDrawer = (function() {
  const drawer = qs('.cart-drawer');
  const overlay = qs('.cart-overlay');
  const openBtns = qsa('[data-open-cart]');
  const closeBtns = qsa('[data-close-cart]');
  const itemsContainer = qs('.cart-drawer__items');
  const subtotalEl = qs('.cart-drawer__subtotal-price');
  const countEls = qsa('.cart-count');

  if (!drawer) return {};

  function open() {
    drawer.classList.add('is-open');
    overlay && overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    refresh();
  }

  function close() {
    drawer.classList.remove('is-open');
    overlay && overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function updateCount(count) {
    countEls.forEach(el => {
      el.textContent = count;
      el.classList.toggle('has-items', count > 0);
    });
  }

  function renderItems(cart) {
    if (!itemsContainer) return;
    if (!cart.items || cart.items.length === 0) {
      itemsContainer.innerHTML = `
        <div class="cart-drawer__empty">
          <p>Your cart is empty</p>
          <a href="/collections/all" class="btn btn--secondary" style="margin-top:1rem;" onclick="CartDrawer.close()">Shop Now</a>
        </div>
      `;
    } else {
      itemsContainer.innerHTML = cart.items.map(item => `
        <div class="cart-item" data-line="${item.key}">
          <div class="cart-item__image">
            ${item.image ? `<img src="${item.image}" alt="${item.product_title}" loading="lazy" width="80" height="107">` : ''}
          </div>
          <div class="cart-item__info">
            <div class="cart-item__title">${item.product_title}</div>
            ${item.variant_title ? `<div class="cart-item__variant">${item.variant_title}</div>` : ''}
            <div class="cart-item__price">${money(item.final_line_price)}</div>
            <div class="cart-item__quantity">
              <button class="cart-item__qty-btn" data-action="decrease" data-key="${item.key}" aria-label="Decrease quantity">−</button>
              <span class="cart-item__qty-value">${item.quantity}</span>
              <button class="cart-item__qty-btn" data-action="increase" data-key="${item.key}" aria-label="Increase quantity">+</button>
            </div>
            <button class="cart-item__remove" data-key="${item.key}">Remove</button>
          </div>
        </div>
      `).join('');
    }

    if (subtotalEl) {
      subtotalEl.textContent = money(cart.total_price);
    }
    updateCount(cart.item_count);
    bindCartItemEvents();
  }

  function bindCartItemEvents() {
    if (!itemsContainer) return;
    qsa('.cart-item__qty-btn', itemsContainer).forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const action = btn.dataset.action;
        const item = btn.closest('.cart-item');
        const qtyEl = qs('.cart-item__qty-value', item);
        let qty = parseInt(qtyEl.textContent);
        qty = action === 'increase' ? qty + 1 : Math.max(0, qty - 1);
        updateItemQuantity(key, qty);
      });
    });

    qsa('.cart-item__remove', itemsContainer).forEach(btn => {
      btn.addEventListener('click', () => {
        updateItemQuantity(btn.dataset.key, 0);
      });
    });
  }

  function refresh() {
    fetch('/cart.js')
      .then(r => r.json())
      .then(renderItems)
      .catch(console.error);
  }

  function updateItemQuantity(key, qty) {
    fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: key, quantity: qty })
    })
    .then(r => r.json())
    .then(renderItems)
    .catch(console.error);
  }

  // Expose add-to-cart
  function addItem(variantId, quantity, properties) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: quantity || 1, properties: properties || {} })
    })
    .then(r => {
      if (!r.ok) return r.json().then(e => Promise.reject(e));
      return r.json();
    })
    .then(item => {
      refresh();
      open();
      return item;
    });
  }

  // Bind open/close buttons
  openBtns.forEach(btn => btn.addEventListener('click', open));
  closeBtns.forEach(btn => btn.addEventListener('click', close));
  overlay && overlay.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // Initial count fetch
  fetch('/cart.js')
    .then(r => r.json())
    .then(cart => updateCount(cart.item_count))
    .catch(() => {});

  return { open, close, addItem, refresh };
})();

window.CartDrawer = CartDrawer;

// ---- Product Form -----------------------------------------------------------

(function initProductForm() {
  const form = qs('.product-form');
  if (!form) return;

  const addBtn = qs('.product-form__add', form);
  const variantIdInput = qs('[name="id"]', form);
  const priceEl = qs('.product-info__price');
  const comparePriceEl = qs('.product-info__price--compare');

  // Variant selection
  const variantOptions = qsa('.variant-option', form);
  let selectedOptions = {};

  // Read initial selected options
  variantOptions.forEach(opt => {
    if (opt.classList.contains('is-selected')) {
      const pos = opt.dataset.optionPosition;
      selectedOptions[pos] = opt.dataset.optionValue;
    }
  });

  variantOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const pos = opt.dataset.optionPosition;
      // Deselect siblings
      qsa(`.variant-option[data-option-position="${pos}"]`, form).forEach(o => {
        o.classList.remove('is-selected');
        o.setAttribute('aria-pressed', 'false');
      });
      opt.classList.add('is-selected');
      opt.setAttribute('aria-pressed', 'true');
      selectedOptions[pos] = opt.dataset.optionValue;
      updateVariant();
    });
  });

  function updateVariant() {
    const variants = JSON.parse(form.dataset.variants || '[]');
    const values = Object.keys(selectedOptions).sort().map(k => selectedOptions[k]);

    const match = variants.find(v => {
      return v.options.every((o, i) => o === values[i]);
    });

    if (match) {
      variantIdInput.value = match.id;

      // Update price
      if (priceEl) {
        priceEl.childNodes[0].nodeValue = money(match.price);
      }
      if (comparePriceEl) {
        if (match.compare_at_price && match.compare_at_price > match.price) {
          comparePriceEl.textContent = money(match.compare_at_price);
          comparePriceEl.style.display = '';
        } else {
          comparePriceEl.textContent = '';
          comparePriceEl.style.display = 'none';
        }
      }

      // Update button state
      if (addBtn) {
        if (!match.available) {
          addBtn.disabled = true;
          addBtn.textContent = 'Sold Out';
        } else {
          addBtn.disabled = false;
          addBtn.textContent = addBtn.dataset.defaultText || 'Add to Cart';
        }
      }

      // Update URL without reload
      const url = new URL(window.location);
      url.searchParams.set('variant', match.id);
      window.history.replaceState({}, '', url);

      // Update gallery if variant has image
      if (match.featured_image) {
        const mainImg = qs('.product-gallery__main img');
        if (mainImg) mainImg.src = match.featured_image.src;
      }
    }
  }

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = variantIdInput.value;
    if (!id) return;

    if (addBtn) {
      addBtn.disabled = true;
      const spinner = document.createElement('span');
      spinner.className = 'loading-spinner';
      addBtn.innerHTML = '';
      addBtn.appendChild(spinner);
    }

    CartDrawer.addItem(id, 1)
      .then(() => {
        showToast('Added to cart');
      })
      .catch(err => {
        showToast(err.description || 'Something went wrong');
      })
      .finally(() => {
        if (addBtn) {
          addBtn.disabled = false;
          addBtn.textContent = addBtn.dataset.defaultText || 'Add to Cart';
        }
      });
  });
})();

// ---- Quick Add --------------------------------------------------------------

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.product-card__quick-add');
  if (!btn) return;
  e.preventDefault();
  const variantId = btn.dataset.variantId;
  if (!variantId) return;

  btn.textContent = '...';
  CartDrawer.addItem(variantId, 1)
    .then(() => {
      btn.textContent = 'Added!';
      showToast('Added to cart');
      setTimeout(() => {
        btn.textContent = btn.dataset.defaultText || 'Quick Add';
      }, 1500);
    })
    .catch(() => {
      btn.textContent = 'Error';
      setTimeout(() => {
        btn.textContent = btn.dataset.defaultText || 'Quick Add';
      }, 1500);
    });
});

// ---- Product Gallery --------------------------------------------------------

(function initProductGallery() {
  const gallery = qs('.product-gallery');
  if (!gallery) return;

  const mainImg = qs('.product-gallery__main img', gallery);
  const thumbs = qsa('.product-gallery__thumb', gallery);

  thumbs.forEach((thumb, i) => {
    thumb.addEventListener('click', () => {
      const src = thumb.dataset.src;
      const srcset = thumb.dataset.srcset;
      if (mainImg && src) {
        mainImg.src = src;
        if (srcset) mainImg.srcset = srcset;
        mainImg.alt = thumb.dataset.alt || '';
      }
      thumbs.forEach(t => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
    });
  });
})();

// ---- Accordion --------------------------------------------------------------

(function initAccordions() {
  qsa('.accordion__trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion__item');
      const content = qs('.accordion__content', item);
      const inner = qs('.accordion__inner', item);
      const isOpen = item.classList.contains('is-open');

      // Close all
      qsa('.accordion__item.is-open').forEach(openItem => {
        openItem.classList.remove('is-open');
        qs('.accordion__content', openItem).style.maxHeight = '0';
        qs('.accordion__trigger', openItem).setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('is-open');
        content.style.maxHeight = inner.scrollHeight + 'px';
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

// ---- Toast ------------------------------------------------------------------

function showToast(msg, duration) {
  let toast = qs('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, duration || 2500);
}

window.showToast = showToast;

// ---- Newsletter Form --------------------------------------------------------

qsa('.newsletter-form').forEach(form => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = qs('input[type="email"]', form).value;
    if (!email) return;

    const btn = qs('[type="submit"]', form);
    const originalText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    // Shopify newsletter subscribe via Customer API
    const fd = new FormData(form);
    fetch('/contact', {
      method: 'POST',
      body: fd,
      headers: { 'Accept': 'application/json' }
    })
    .then(() => {
      showToast('Thank you for subscribing!');
      qs('input[type="email"]', form).value = '';
    })
    .catch(() => showToast('Subscribed!'))
    .finally(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    });
  });
});

// ---- Scroll-based Header Shadow ---------------------------------------------

(function initHeaderScroll() {
  const header = qs('.site-header');
  if (!header) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (window.scrollY > 10) {
          header.classList.add('is-scrolled');
        } else {
          header.classList.remove('is-scrolled');
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

// ---- Lazy Images ------------------------------------------------------------

(function initLazyLoad() {
  if ('IntersectionObserver' in window) {
    const images = qsa('img[loading="lazy"]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });

    images.forEach(img => observer.observe(img));
  }
})();

// ---- Cart Page (full page) --------------------------------------------------

(function initCartPage() {
  const cartForm = qs('.cart-page-form');
  if (!cartForm) return;

  qsa('.cart-page-qty-btn', cartForm).forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const action = btn.dataset.action;
      const row = btn.closest('[data-cart-item]');
      const qtyEl = qs('.cart-page-qty-value', row);
      let qty = parseInt(qtyEl.textContent);
      qty = action === 'increase' ? qty + 1 : Math.max(0, qty - 1);

      fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      })
      .then(r => r.json())
      .then(() => window.location.reload())
      .catch(console.error);
    });
  });
})();
