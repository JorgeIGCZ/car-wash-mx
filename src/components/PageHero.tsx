import Image from "next/image";

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
};

export function PageHero({
  eyebrow = "TURBO WASH",
  title,
  children,
}: PageHeroProps) {
  return (
    <header className="page-hero">
      <div className="hero-title-row">
        <div className="hero-logo">
          <Image
            src="/turbo-wash-logo.jpg"
            alt=""
            width={100}
            height={56}
            priority
          />
        </div>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
      {children}
    </header>
  );
}
