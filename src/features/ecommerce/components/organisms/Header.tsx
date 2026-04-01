"use client";
import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { isOn } from '../../config/featureFlags';
import { useCart } from '../../state/CartContext';
import { useOrderForm } from '../../state/OrderFormContext';
import { resolveSelectedShippingOption } from '../../lib/logisticsClient';
import { Button } from '../atoms/Button';
import { useUI } from '../../state/UIContext';
import { DepartmentsDropdown } from './Dropdowns';
import { Modal } from '../atoms/Modal';
import dynamic from 'next/dynamic';
const DeliveryModal = dynamic(() => import('../molecules/DeliveryModal').then(module => module.DeliveryModal), { ssr: false });
import { SearchIcon, CartIcon, MenuIcon } from '../atoms/Icon';
import type { StorefrontTemplate, StorefrontTemplateLink } from '@/features/site-runtime/storefrontTemplate';
import { DEFAULT_STOREFRONT_TEMPLATE } from '@/features/site-runtime/storefrontTemplate';
import { trackStorefrontEvent } from '@/features/analytics/client/runtime';
import { sanitizeUrl } from '@/utils/inputSecurity';

function renderTemplateLink(link: StorefrontTemplateLink, className: string) {
  if (!link.enabled) return null;
  const safeHref = sanitizeUrl(link.href, { fallback: '#', allowRelative: true, allowAnchor: true });
  if (/^https?:\/\//.test(safeHref)) {
    return (
      <a key={link.id} href={safeHref} className={className}>
        {link.label}
      </a>
    );
  }

  return (
    <Link key={link.id} href={safeHref} className={className}>
      {link.label}
    </Link>
  );
}

export default function Header({ template = DEFAULT_STOREFRONT_TEMPLATE }: { template?: StorefrontTemplate }) {
  const { totalItems } = useCart();
  const { orderForm } = useOrderForm();
  const { toggleCart, isDeliveryModalOpen, openDeliveryModal, closeDeliveryModal } = useUI();
  const [term, setTerm] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [isCondensed, setIsCondensed] = useState(false);
  const [backToTopVisible, setBackToTopVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [customerSessionEmail, setCustomerSessionEmail] = useState('');
  const headerRef = React.useRef<HTMLElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const headerModules = template.header.modules;
  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    let mounted = true;
    fetch('/api/ecommerce/account/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!mounted) return;
        const payload = (await response.json().catch(() => null)) as { authenticated?: boolean; account?: { profile?: { email?: string } } } | null;
        setCustomerSessionEmail(payload?.authenticated ? payload?.account?.profile?.email || '' : '');
      })
      .catch(() => {
        if (mounted) setCustomerSessionEmail('');
      });
    return () => {
      mounted = false;
    };
  }, [pathname, orderForm.clientProfileData?.email]);
  useEffect(() => {
    const onScroll = () => {
      const offsetY = window.scrollY || 0;
      setIsCondensed(offsetY > 64);
      setBackToTopVisible(offsetY > 520);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const element = headerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const nextHeight = Math.ceil(element.getBoundingClientRect().height);
      setHeaderHeight(nextHeight);
    });
    observer.observe(element);
    setHeaderHeight(Math.ceil(element.getBoundingClientRect().height));
    return () => observer.disconnect();
  }, [isCondensed, hydrated, totalItems]);
  const isCheckoutFlow = pathname.startsWith('/e-commerce/checkout');
  const isCartFlow = pathname.startsWith('/e-commerce/cart');
  const isAccountFlow = pathname.startsWith('/e-commerce/minha-conta');
  const isCustomerLoginFlow = pathname.startsWith('/e-commerce/login');
  const isSimpleHeader = isCheckoutFlow || isCartFlow || isAccountFlow || isCustomerLoginFlow;
  const enableCondensed = isOn('ecom.header.condensed');
  const showPromoBar = headerModules.promoBar && isOn('ecom.header.promoBar');
  const showDeliveryPill = isOn('ecom.header.deliveryPill');
  const showUtilBar = headerModules.utilLinks && isOn('ecom.header.utilBar');
  const showUtilClub = isOn('ecom.header.util.club');
  const showUtilHelp = isOn('ecom.header.util.help');
  const showUtilLogin = isOn('ecom.header.util.login');
  const showTopRow = isOn('ecom.header.topRow');
  const showLogo = isOn('ecom.header.logo');
  const showSearch = isOn('ecom.header.search');
  const showFavorite = isOn('ecom.header.actions.favorite');
  const showCartAction = isOn('ecom.header.actions.cart');
  const showQuickLogin = headerModules.quickLogin && isOn('ecom.header.actions.loginQuick');
  const showAccount = isOn('ecom.header.actions.account');
  const showNav = isOn('ecom.header.nav');
  const showNavDepartments = headerModules.departmentsMenu && isOn('ecom.header.nav.departments');
  const showNavMeta = headerModules.navMeta && isOn('ecom.header.nav.meta');
  const showBackToTop = isOn('ecom.header.backToTop') && backToTopVisible;
  const customerEntryHref = customerSessionEmail || orderForm.clientProfileData?.email ? '/e-commerce/minha-conta' : '/e-commerce/login';
  const customerEntryLabel = customerSessionEmail || orderForm.clientProfileData?.email ? 'Minha conta' : 'Entrar';
  const utilLinks = template.header.utilLinks.filter((link) => {
    if (!link.enabled) return false;
    if (link.id === 'club') return showUtilClub;
    if (link.id === 'help') return showUtilHelp;
    if (link.id === 'login') return showUtilLogin;
    return true;
  });
  const quickLogin = template.header.quickLogin;
  const selectedAddress = orderForm.shipping.selectedAddress;
  const selectedOption = resolveSelectedShippingOption(orderForm.shipping);
  const cepDigits = (selectedAddress?.postalCode || '').replace(/\D/g, '');
  const formattedCep = cepDigits.length === 8 ? cepDigits.replace(/(\d{5})(\d{3})/, '$1-$2') : '';
  const regionalizationSummary = selectedOption?.id?.startsWith('pickup')
    ? 'Retirada em loja selecionada'
    : formattedCep
      ? `Entregar no CEP ${formattedCep}`
      : 'Como deseja receber suas compras?';
  const deliverySummaryLabel = hydrated ? regionalizationSummary : 'Como deseja receber suas compras?';
  const deliveryModeLabel = hydrated && selectedOption?.id?.startsWith('pickup')
    ? 'Retirada em loja ativa'
    : 'Retirar em loja';
  
  if (!isOn('ecom.header')) return null;
  if (!isSimpleHeader && !headerModules.enabled) return null;

  if (isSimpleHeader) {
    return (
      <>
        <header ref={headerRef} className="ecom-header ecom-header--simple">
          <div className="container">
            <div className="ecom-header__simpleRow">
              <div className="ecom-header__brand">
                <Link href="/e-commerce" aria-label="Ir para a Home">{template.brandName}</Link>
              </div>
              <div className="ecom-header__simpleActions">
                <Link href="/e-commerce" className="ecom-header__simpleLink" data-track-id="simple-header-home">
                  {template.header.simpleHomeLabel}
                </Link>
                {isCheckoutFlow ? (
                  <Link href="/e-commerce/cart" className="ecom-header__simpleLink" data-track-id="simple-header-cart">
                    {template.header.simpleCartLabel}
                  </Link>
                ) : null}
                {isAccountFlow || isCustomerLoginFlow ? (
                  <>
                    <Link href="/e-commerce/cart" className="ecom-header__simpleLink" data-track-id="simple-header-cart">
                      Carrinho
                    </Link>
                    <Link href={customerEntryHref} className="ecom-header__simpleLink" data-track-id="simple-header-account">
                      {customerEntryLabel}
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <div className="ecom-header-spacer" aria-hidden style={{ height: headerHeight }} />
      </>
    );
  }

  return (
    <>
      <header ref={headerRef} className={`ecom-header ${isCondensed && enableCondensed ? 'ecom-header--condensed' : ''}`}>
        <div className="container">
          {showPromoBar ? (
            <div className="ecom-header__promo" role="note" aria-label="Promoções">
              {template.header.promoText}
            </div>
          ) : null}
          {showDeliveryPill ? (
            <div className="ecom-header__delivery">
              <button
                className="delivery-pill"
                aria-label="Selecionar como deseja receber"
                data-track-id="header-open-delivery"
                onClick={openDeliveryModal}
              >
                <span className="pill-ico" aria-hidden>📍</span>
                <span>{deliverySummaryLabel}</span>
              </button>
            </div>
          ) : null}
          {showUtilBar ? (
            <div className="ecom-header__util">
              <div className="ecom-header__loc">
                <button
                  className="delivery-trigger"
                  data-track-id="header-open-delivery"
                  onClick={openDeliveryModal}
                >
                  {deliveryModeLabel}
                </button>
              </div>
              <div className="ecom-header__links">
                {utilLinks.map((link) => {
                  if (link.id === 'login') {
                    return (
                      <Link key={link.id} href={customerEntryHref} className="ecom-link">
                        {customerEntryLabel}
                      </Link>
                    );
                  }
                  return renderTemplateLink(link, 'ecom-link');
                })}
              </div>
            </div>
          ) : null}

          {showTopRow ? (
            <div className="ecom-header__top">
              <div className="ecom-header__burger">
                {showNavDepartments ? (
                  <DepartmentsDropdown
                    template={template}
                    trigger={<button className="ecom-nav__btn ecom-nav__btn--departments" aria-label="Abrir menu"><MenuIcon /></button>}
                  />
                ) : null}
              </div>
              {showLogo ? (
                <div className="ecom-header__brand">
                  <Link href="/e-commerce" aria-label="Ir para a Home">{template.brandName}</Link>
                </div>
              ) : null}
              {showSearch ? (
                <form
                  className="ecom-header__search"
                  role="search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    trackStorefrontEvent({
                      type: 'search_submit',
                      pathname: '/e-commerce/plp',
                      searchQuery: term.trim(),
                      label: 'Busca do header',
                    });
                    router.push(`/e-commerce/plp?q=${encodeURIComponent(term)}`);
                  }}
                >
                  <input
                    placeholder={template.header.searchPlaceholder}
                    aria-label="Buscar produtos"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                  <Button type="submit" variant="icon" aria-label="Buscar" className="ecom-header__searchBtn"><SearchIcon size={26} /></Button>
                </form>
              ) : null}
              <div className="ecom-header__actions">
                {showAccount ? (
                  <Link href={customerEntryHref} className="ecom-header__quick-login">
                    {customerEntryLabel}
                  </Link>
                ) : null}
                {showQuickLogin && quickLogin.enabled ? (
                  <Link href={customerEntryHref} className="ecom-header__quick-login">
                    {customerSessionEmail || orderForm.clientProfileData?.email ? customerEntryLabel : quickLogin.label || customerEntryLabel}
                  </Link>
                ) : null}
                {showFavorite ? <Button variant="icon" aria-label="Favoritos" data-fav>❤</Button> : null}
                {showCartAction ? (
                  <Button
                    variant="icon"
                    aria-label="Ver carrinho"
                    onClick={toggleCart}
                    data-track-id="header-open-cart"
                    className="ecom-cartBtn"
                    data-count={hydrated ? totalItems : 0}
                  >
                    <CartIcon />
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {showNav ? (
            <nav className="ecom-header__nav">
              {showNavDepartments ? <DepartmentsDropdown template={template} /> : null}
              {showNavMeta ? <span className="ecom-nav__meta">{template.header.navMetaText}</span> : null}
            </nav>
          ) : null}
        </div>
        
        <Modal 
          isOpen={isDeliveryModalOpen} 
          onClose={closeDeliveryModal}
          className="delivery-modal-wrapper"
        >
          <DeliveryModal onClose={closeDeliveryModal} />
        </Modal>
      </header>
      <div className="ecom-header-spacer" aria-hidden style={{ height: headerHeight }} />
      {showBackToTop ? (
        <button
          type="button"
          className="ecom-back-to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
        >
          ↑
        </button>
      ) : null}
    </>
  );
}
