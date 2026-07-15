import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  arrow?: boolean;
  disabled?: boolean;
};

export function ArrowLink({ href, onClick, children, className, arrow = true, disabled }: Props) {
  const cls = `arrow-link${className ? " " + className : ""}`;
  const inner = (
    <>
      <span>{children}</span>
      {arrow && <span className="arrow-ico" aria-hidden="true">{">"}</span>}
    </>
  );
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button type="button" className={cls} onClick={onClick} disabled={disabled}>{inner}</button>;
}
