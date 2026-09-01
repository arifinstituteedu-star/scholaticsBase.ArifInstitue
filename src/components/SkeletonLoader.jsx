import React, { useState, useEffect } from 'react';

/**
 * Preloads an array or single URL of images into browser memory.
 * Resolves true when all images load or fail (prevents hanging skeleton UI).
 */
export const preloadImages = (urls) => {
  const urlArray = Array.isArray(urls) ? urls : [urls];
  const promises = urlArray
    .filter((url) => typeof url === 'string' && url.trim().length > 0)
    .map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
        })
    );
  return Promise.all(promises);
};

/**
 * Custom CSS-Based Shimmer Skeleton element
 * Works with or without external npm dependencies
 */
export function BaseSkeleton({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
  circle = false,
  style = {},
  className = '',
  count = 1,
}) {
  const items = Array.from({ length: count });

  return (
    <>
      {items.map((_, index) => (
        <span
          key={index}
          className={`skeleton-shimmer ${className}`}
          style={{
            width,
            height,
            borderRadius: circle ? '50%' : borderRadius,
            marginBottom: count > 1 && index < count - 1 ? '8px' : style.marginBottom,
            ...style,
          }}
        />
      ))}
    </>
  );
}

/**
 * SkeletonWrapper for consistent container padding & styling
 */
export function SkeletonWrapper({ children }) {
  return <div className="skeleton-container-wrapper">{children}</div>;
}

/**
 * Card Grid Skeleton - For Admin/Teacher/Student dashboards
 */
export function CardSkeleton({ count = 4, height = 140 }) {
  return (
    <SkeletonWrapper>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', width: '100%' }}>
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            style={{
              background: '#ffffff',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <BaseSkeleton circle width="46px" height="46px" />
              <div style={{ flex: 1 }}>
                <BaseSkeleton width="60%" height="18px" />
                <BaseSkeleton width="40%" height="14px" style={{ marginTop: 6 }} />
              </div>
            </div>
            <BaseSkeleton height={`${height - 80}px`} />
          </div>
        ))}
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Table Skeleton - For Exam Results, Fee Records, Routines, and Lists
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <SkeletonWrapper>
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          width: '100%',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #f1f5f9' }}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <BaseSkeleton key={colIdx} style={{ flex: 1 }} height="24px" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} style={{ display: 'flex', gap: '16px', marginBottom: '14px', alignItems: 'center' }}>
            {Array.from({ length: columns }).map((_, colIdx) => (
              <BaseSkeleton key={colIdx} style={{ flex: 1 }} height="20px" />
            ))}
          </div>
        ))}
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Portal Route Skeleton - Seamless substitute for ProtectedRoute loading screens
 */
export function PortalSkeleton({ message = 'Loading application portal...' }) {
  return (
    <SkeletonWrapper>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '20px',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '20px',
            padding: '36px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
            textAlign: 'center',
          }}
        >
          <div style={{ margin: '0 auto 20px auto', width: '64px', height: '64px' }}>
            <BaseSkeleton circle width="64px" height="64px" />
          </div>
          <BaseSkeleton width="70%" height="24px" style={{ margin: '0 auto 12px auto' }} />
          <BaseSkeleton width="90%" height="16px" count={2} style={{ marginTop: '8px' }} />
          <p style={{ color: '#64748b', fontSize: '13.5px', marginTop: '20px', fontWeight: 500 }}>
            {message}
          </p>
        </div>
      </div>
    </SkeletonWrapper>
  );
}

/**
 * ImageWithSkeleton - Drop-in replacement for <img> tags with automated Firebase Storage Skeleton loader
 */
export function ImageWithSkeleton({
  src,
  alt = '',
  width,
  height,
  borderRadius = '8px',
  style = {},
  className = '',
  objectFit = 'cover',
  fallbackText = '',
  ...props
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setError(true);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    setError(false);

    let isMounted = true;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      if (isMounted) setLoaded(true);
    };
    img.onerror = () => {
      if (isMounted) {
        setError(true);
        setLoaded(true);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [src]);

  const containerStyle = {
    position: 'relative',
    display: 'inline-block',
    width: width || '100%',
    height: height || '100%',
    borderRadius,
    overflow: 'hidden',
    ...style,
  };

  return (
    <SkeletonWrapper>
      <div style={containerStyle} className={`img-skeleton-wrapper ${className}`}>
        {!loaded && (
          <BaseSkeleton
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius,
            }}
          />
        )}
        {src && !error && (
          <img
            src={src}
            alt={alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit,
              borderRadius,
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out',
              display: 'block',
            }}
            {...props}
          />
        )}
        {error && (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '14px',
              borderRadius,
            }}
          >
            {fallbackText || alt?.charAt(0)?.toUpperCase() || '📷'}
          </div>
        )}
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Exam Directory Skeleton — Displays shimmering KPI ribbon + session cards
 */
export function ExamDirectorySkeleton() {
  return (
    <SkeletonWrapper>
      <div style={{ padding: '4px 0', width: '100%' }}>
        {/* KPI Grid Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <BaseSkeleton circle width="48px" height="48px" />
              <div style={{ flex: 1 }}>
                <BaseSkeleton width="50%" height="13px" style={{ marginBottom: 6 }} />
                <BaseSkeleton width="70%" height="24px" style={{ marginBottom: 6 }} />
                <BaseSkeleton width="40%" height="11px" />
              </div>
            </div>
          ))}
        </div>

        {/* Action Header Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ minWidth: '240px', flex: 1 }}>
            <BaseSkeleton width="60%" height="22px" style={{ marginBottom: 6 }} />
            <BaseSkeleton width="45%" height="14px" />
          </div>
          <BaseSkeleton width="180px" height="42px" borderRadius="10px" />
        </div>

        {/* Branch Banner & Cards Skeleton */}
        <div style={{ background: '#ffffff', borderRadius: '18px', border: '1.5px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
          <BaseSkeleton width="100%" height="60px" borderRadius="14px" style={{ marginBottom: '20px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <BaseSkeleton width="60%" height="20px" />
                  <BaseSkeleton width="50px" height="20px" borderRadius="12px" />
                </div>
                <BaseSkeleton width="90%" height="14px" count={2} style={{ marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <BaseSkeleton width="50%" height="32px" borderRadius="8px" />
                  <BaseSkeleton width="50%" height="32px" borderRadius="8px" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Tabulation Sheet Skeleton — Displays shimmering report header + student rows
 */
export function TabulationSkeleton() {
  return (
    <SkeletonWrapper>
      <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '28px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        {/* Header summary */}
        <div style={{ textAlign: 'center', marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px dashed #e2e8f0' }}>
          <BaseSkeleton width="40%" height="28px" style={{ margin: '0 auto 10px auto' }} />
          <BaseSkeleton width="25%" height="18px" style={{ margin: '0 auto 8px auto' }} />
          <BaseSkeleton width="30%" height="14px" style={{ margin: '0 auto' }} />
        </div>

        {/* Filter bar skeleton */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <BaseSkeleton width="180px" height="38px" borderRadius="10px" />
          <BaseSkeleton width="140px" height="38px" borderRadius="10px" />
          <BaseSkeleton width="140px" height="38px" borderRadius="10px" />
          <div style={{ flex: 1 }} />
          <BaseSkeleton width="130px" height="38px" borderRadius="10px" />
        </div>

        {/* Table Rows skeleton */}
        <div style={{ display: 'flex', gap: '12px', padding: '14px 16px', background: '#f8fafc', borderRadius: '10px', marginBottom: '14px' }}>
          <BaseSkeleton width="50px" height="18px" />
          <BaseSkeleton width="80px" height="18px" />
          <BaseSkeleton width="200px" height="18px" />
          <BaseSkeleton style={{ flex: 1 }} height="18px" />
          <BaseSkeleton width="100px" height="18px" />
          <BaseSkeleton width="80px" height="18px" />
        </div>

        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
            <BaseSkeleton width="50px" height="16px" />
            <BaseSkeleton width="80px" height="16px" />
            <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BaseSkeleton circle width="28px" height="28px" />
              <BaseSkeleton width="140px" height="16px" />
            </div>
            <BaseSkeleton style={{ flex: 1 }} height="16px" />
            <BaseSkeleton width="100px" height="16px" />
            <BaseSkeleton width="80px" height="22px" borderRadius="12px" />
          </div>
        ))}
      </div>
    </SkeletonWrapper>
  );
}

export default {
  preloadImages,
  BaseSkeleton,
  SkeletonWrapper,
  CardSkeleton,
  TableSkeleton,
  PortalSkeleton,
  ImageWithSkeleton,
  ExamDirectorySkeleton,
  TabulationSkeleton,
};
