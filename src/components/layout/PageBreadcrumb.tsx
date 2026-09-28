import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbSegment {
  label: string;
  path?: string | null;
}

interface PageBreadcrumbProps {
  segments: BreadcrumbSegment[];
  className?: string;
}

/**
 * Navegação em migalhas para indicar onde o usuário está e permitir voltar rapidamente.
 * Ex.: Início > Pacientes > Maria Silva
 */
export function PageBreadcrumb({ segments, className = '' }: PageBreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {segments.map((seg, i) => (
          <span key={i} className="contents">
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {seg.path ? (
                <BreadcrumbLink asChild>
                  <Link to={seg.path}>{seg.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{seg.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
