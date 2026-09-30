import jackAcademyMark from '../assets/jack-academy-mark.svg';
import jackAcademyHorizontal from '../assets/jack-academy-horizontal.svg';

/** The Academy mark is shared with the favicon and certificate seal. */
export function Logo({ size = 32 }: { size?: number }) {
  return <img src={jackAcademyMark} width={size} height={size} alt="" aria-hidden="true" className="shrink-0" />;
}

export function BrandName({ className = '' }: { className?: string }) {
  return (
    <span className={`shrink-0 ${className}`}>
      <img src={jackAcademyHorizontal} width={1766} height={240} alt="Jack Academy" className="h-auto w-28 sm:w-44" />
    </span>
  );
}
