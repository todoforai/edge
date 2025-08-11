export const LogoImage = ({ src, alt, size = 48 }: { src: string; alt: string; size?: number }) => (
  <img src={src} alt={alt} width={size} height={size} />
);
