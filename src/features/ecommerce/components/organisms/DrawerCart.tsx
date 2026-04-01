"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../state/CartContext';
import { useUI } from '../../state/UIContext';
import Image from 'next/image';
import { Button } from '../atoms/Button';
import { isOn } from '../../config/featureFlags';

interface CartItemWithDetails {
  id: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
  listPrice?: number;
  brand?: string;
  unit?: string;
  weight?: string;
  packSize?: number;
  category?: string;
  promotionLabel?: string;
  isOrganic?: boolean;
}

export default function DrawerCart() {
  const { isCartOpen, closeCart } = useUI();
  const { state, inc, dec, remove, totalItems, clear } = useCart();
  const router = useRouter();
  const items = Object.values(state.items);
  const hasCompactView = isOn('ecom.drawer.list.compact');
  const hasDetailedView = isOn('ecom.drawer.list.detailed');
  const hasViewSwitch = isOn('ecom.drawer.viewSwitch') && hasCompactView && hasDetailedView;
  const showPromotionBanner = isOn('ecom.drawer.promotionBanner');
  const showFooterSummary = isOn('ecom.drawer.footerSummary');
  const [viewMode, setViewMode] = React.useState<'detailed' | 'compact'>(hasCompactView ? 'compact' : 'detailed');

  React.useEffect(() => {
    if (viewMode === 'compact' && !hasCompactView && hasDetailedView) {
      setViewMode('detailed');
    }
    if (viewMode === 'detailed' && !hasDetailedView && hasCompactView) {
      setViewMode('compact');
    }
  }, [viewMode, hasCompactView, hasDetailedView]);
  
  const calculations = React.useMemo(() => {
    let originalTotal = 0;
    let discountTotal = 0;
    let finalTotal = 0;
    let itemsWithPromotion = 0;
    let totalDiscount = 0;
    
    items.forEach(item => {
      const qty = item.qty;
      const price = item.price;
      const listPrice = item.listPrice || price;
      
      const itemOriginalTotal = listPrice * qty;
      const itemFinalTotal = price * qty;
      const itemDiscount = itemOriginalTotal - itemFinalTotal;
      
      originalTotal += itemOriginalTotal;
      finalTotal += itemFinalTotal;
      
      if (itemDiscount > 0) {
        discountTotal += itemDiscount;
        itemsWithPromotion++;
      }
    });
    
    totalDiscount = discountTotal;
    const discountPercent = originalTotal > 0 ? (discountTotal / originalTotal) * 100 : 0;
    
    return {
      originalTotal,
      discountTotal,
      finalTotal,
      hasDiscounts: discountTotal > 0,
      itemsWithPromotion,
      totalDiscount,
      discountPercent: Math.round(discountPercent),
      savings: discountTotal
    };
  }, [items]);

  const getProductInfo = (item: CartItemWithDetails) => {
    const weight = item.unit ? `${item.packSize || 1}${item.unit}` : 
                  (item.name.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|un)/i)?.[0] || 'un');

    const brand = item.name.split(' ')[0];

    const hasDiscount = item.listPrice && item.listPrice > item.price;
    const discountPercent = hasDiscount ? Math.round((1 - item.price / item.listPrice!) * 100) : 0;
    
    let promotionLabel = '';
    if (hasDiscount) {
      if (discountPercent >= 30) promotionLabel = '🔥 Super Oferta';
      else if (discountPercent >= 20) promotionLabel = '⚡ Promoção';
      else if (discountPercent >= 10) promotionLabel = '💰 Desconto';
    }
    
    return {
      weight,
      brand,
      hasDiscount,
      discountPercent,
      promotionLabel,
      isOrganic: item.name.toLowerCase().includes('orgânico'),
      category: item.name.includes('kg') ? 'Hortifruti' : 'Mercearia'
    };
  };

  return (
    <div className={`drawer ecom-tokens ${isCartOpen ? 'open' : ''}`} aria-hidden={!isCartOpen}>
      <div className="drawer__overlay" onClick={closeCart} />
      <aside className="drawer__panel" aria-label="Meu carrinho" role="dialog" aria-modal="true">
        <header className="drawer__header">
          <button className="drawer__close" aria-label="Fechar" onClick={closeCart}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="drawer__header-info">
            <strong className="drawer__title">Meu carrinho</strong>
            <span className="drawer__count">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
          </div>
          {items.length > 0 && (
            <button className="drawer__clear" onClick={clear}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3,6 5,6 21,6"></polyline>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Limpar
            </button>
          )}
        </header>
        
        <div className="drawer__content">
          {items.length === 0 ? (
            <div className="drawer__empty">
              <div className="drawer__empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="21" r="1"></circle>
                  <circle cx="19" cy="21" r="1"></circle>
                  <path d="m2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
                </svg>
              </div>
              <p>Seu carrinho está vazio</p>
              <small>Adicione produtos e aproveite nossas ofertas!</small>
              <div style={{ marginTop: 12 }}>
                <Button onClick={() => { closeCart(); router.push('/e-commerce/plp'); }}>Ir às compras</Button>
              </div>
            </div>
          ) : (
            <div className="drawer__list-container">
              {hasViewSwitch ? (
                <div className="drawer__view-switch" role="tablist" aria-label="Visualização do carrinho">
                  <button
                    role="tab"
                    className={`drawer__view-tab ${viewMode === 'detailed' ? 'is-active' : ''}`}
                    aria-selected={viewMode === 'detailed'}
                    onClick={() => setViewMode('detailed')}
                  >
                    Visão detalhada
                  </button>
                  <button
                    role="tab"
                    className={`drawer__view-tab ${viewMode === 'compact' ? 'is-active' : ''}`}
                    aria-selected={viewMode === 'compact'}
                    onClick={() => setViewMode('compact')}
                  >
                    Visão rápida
                  </button>
                </div>
              ) : null}

              {showPromotionBanner && calculations.hasDiscounts && (
                <div className="drawer__promotion-banner">
                  <div className="drawer__promotion-icon">🎉</div>
                  <div className="drawer__promotion-text">
                    <strong>Você está economizando!</strong>
                    <small>{calculations.discountPercent}% de desconto • R$ {calculations.savings.toFixed(2)} em economia</small>
                  </div>
                </div>
              )}
              
              {(viewMode === 'detailed' && hasDetailedView) || !hasCompactView ? (
                <ul className="drawer__list">
                  {items.map((it) => {
                    const productInfo = getProductInfo(it as CartItemWithDetails);
                    const itemTotal = it.price * it.qty;
                    const itemOriginalTotal = (it.listPrice || it.price) * it.qty;
                    const itemSavings = itemOriginalTotal - itemTotal;
                    
                    return (
                      <li key={it.id} className="drawer__item">
                        <div className="drawer__item-image">
                          <Image 
                            src={it.image || '/file.svg'} 
                            alt={it.name} 
                            width={80} 
                            height={80}
                          />
                          {productInfo.hasDiscount && (
                            <div className="drawer__item-discount-badge">
                              -{productInfo.discountPercent}%
                            </div>
                          )}
                        </div>
                        
                        <div className="drawer__item-details">
                          <div className="drawer__item-header">
                            <h4 className="drawer__item-title">{it.name}</h4>
                            <button 
                              className="drawer__remove" 
                              aria-label="Remover item" 
                              onClick={() => remove(it.id)}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                              </svg>
                            </button>
                          </div>
                          
                          <div className="drawer__item-meta">
                            <span className="drawer__item-brand">{productInfo.brand}</span>
                            <span className="drawer__item-weight">{productInfo.weight}</span>
                            {productInfo.isOrganic && <span className="drawer__item-organic">🌱 Orgânico</span>}
                          </div>
                          
                          {productInfo.promotionLabel && (
                            <div className="drawer__item-promotion">
                              {productInfo.promotionLabel}
                            </div>
                          )}
                          
                          <div className="drawer__item-pricing">
                            <div className="drawer__item-prices">
                              {productInfo.hasDiscount && (
                                <span className="drawer__price-original">
                                  R$ {it.listPrice!.toFixed(2)}
                                </span>
                              )}
                              <span className="drawer__price-current">
                                R$ {it.price.toFixed(2)}
                              </span>
                              <span className="drawer__price-unit">cada</span>
                            </div>
                            
                            <div className="drawer__item-total-price">
                              {itemSavings > 0 && (
                                <div className="drawer__item-savings">
                                  Economia: R$ {itemSavings.toFixed(2)}
                                </div>
                              )}
                              <strong className="drawer__item-total">
                                R$ {itemTotal.toFixed(2)}
                              </strong>
                            </div>
                          </div>
                          
                          <div className="drawer__item-controls">
                            <div className="drawer__qty">
                              <Button 
                                variant="ghost" 
                                onClick={() => dec(it.id)} 
                                className="drawer__qty-btn"
                                disabled={it.qty <= 1}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                              </Button>
                              <span className="drawer__qty-value">{it.qty}</span>
                              <Button 
                                variant="ghost" 
                                onClick={() => inc(it.id)} 
                                className="drawer__qty-btn"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="12" y1="5" x2="12" y2="19"></line>
                                  <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : hasCompactView ? (
                <ul className="drawer__list drawer__list--compact">
                  {items.map((it) => {
                    const productInfo = getProductInfo(it as CartItemWithDetails);
                    const itemTotal = it.price * it.qty;
                    return (
                      <li key={it.id} className="drawer__item drawer__item--compact">
                        <div className="drawer__compact-main">
                          <h4 className="drawer__compact-title">{it.name}</h4>
                          {productInfo.hasDiscount ? <span className="drawer__compact-discount">-{productInfo.discountPercent}%</span> : null}
                        </div>
                        <div className="drawer__compact-pricing" title={`R$ ${it.price.toFixed(2)} cada`}>
                          <strong className="drawer__compact-total">R$ {itemTotal.toFixed(2)}</strong>
                        </div>
                        <div className="drawer__qty drawer__qty--compact">
                          <Button
                            variant="ghost"
                            onClick={() => dec(it.id)}
                            className="drawer__qty-btn"
                            disabled={it.qty <= 1}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                          </Button>
                          <span className="drawer__qty-value">{it.qty}</span>
                          <Button
                            variant="ghost"
                            onClick={() => inc(it.id)}
                            className="drawer__qty-btn"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                          </Button>
                        </div>
                        <button
                          className="drawer__remove drawer__remove--compact"
                          aria-label="Remover item"
                          onClick={() => remove(it.id)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          )}
        </div>
        
        {items.length > 0 && showFooterSummary && (
          <footer className="drawer__footer">
            <div className="drawer__summary">
              <div className="drawer__summary-header">
                <h3>Resumo do pedido</h3>
                <span className="drawer__summary-items">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
              </div>
              
              <div className="drawer__summary-breakdown">
                <div className="drawer__summary-line">
                  <span>Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'itens'})</span>
                  <span>R$ {calculations.originalTotal.toFixed(2)}</span>
                </div>
                
                {calculations.hasDiscounts && (
                  <div className="drawer__summary-line drawer__summary-discount">
                    <span>Descontos aplicados</span>
                    <span>- R$ {calculations.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="drawer__summary-line drawer__summary-shipping">
                  <span>Frete</span>
                  <span className="drawer__summary-shipping-info">Calculado na finalização</span>
                </div>
              </div>
              
              <div className="drawer__total">
                <div className="drawer__total-line">
                  <span>Total</span>
                  <div className="drawer__total-price">
                    <strong>R$ {calculations.finalTotal.toFixed(2)}</strong>
                    {calculations.hasDiscounts && (
                      <small className="drawer__total-savings">
                        Economia de R$ {calculations.savings.toFixed(2)}
                      </small>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="drawer__actions">
              <Button variant="ghost" className="drawer__continue-shopping" onClick={closeCart}>
                Continuar comprando
              </Button>
              <Button
                className="drawer__checkout"
                onClick={() => {
                  closeCart();
                  router.push('/e-commerce/cart');
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16,8 20,8 23,11 23,16 16,16 16,8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
                Finalizar pedido
              </Button>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
