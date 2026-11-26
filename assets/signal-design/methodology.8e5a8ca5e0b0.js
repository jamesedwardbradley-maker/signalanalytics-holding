(() => {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('#main-navigation');
  const closeMenu = () => {menu.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.textContent='Menu';};
  toggle.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Close':'Menu';
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click',closeMenu));
  document.addEventListener('keydown', event => {if(event.key==='Escape'&&menu.classList.contains('is-open')){closeMenu();toggle.focus();}});
  document.addEventListener('click', event => {if(!event.target.closest('.site-nav'))closeMenu();});
  const tabs = [...document.querySelectorAll('.formula-tab')];
  function selectTab(tab) {
    tabs.forEach(t => {const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active;});
  }
  tabs.forEach((tab,i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if(event.key==='ArrowRight')next=tabs[(i+1)%tabs.length];
      if(event.key==='ArrowLeft')next=tabs[(i+tabs.length-1)%tabs.length];
      if(event.key==='Home')next=tabs[0];if(event.key==='End')next=tabs[tabs.length-1];
      if(next){event.preventDefault();selectTab(next);next.focus();}
    });
  });
  const guide = document.querySelector('#guide-select');
  guide.addEventListener('change', () => {location.hash=guide.value;document.getElementById(guide.value).focus({preventScroll:true});});
  const links = [...document.querySelectorAll('.guide-nav ol a')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  let queued = false;
  function updateGuide() {
    let active=sections[0];
    for(const section of sections){if(section.getBoundingClientRect().top<=190)active=section;}
    links.forEach(a=>{if(a.hash==='#'+active.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    if(document.activeElement!==guide)guide.value=active.id;
    queued=false;
  }
  addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(updateGuide);}},{passive:true});
  updateGuide();
  addEventListener('beforeprint',()=>document.querySelectorAll('.model').forEach(d=>{d.dataset.wasOpen=String(d.open);d.open=true;}));
  addEventListener('afterprint',()=>document.querySelectorAll('.model').forEach(d=>{d.open=d.dataset.wasOpen==='true';delete d.dataset.wasOpen;}));
})();
