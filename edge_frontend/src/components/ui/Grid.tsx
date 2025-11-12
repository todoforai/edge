import { cn } from "@/lib/utils";

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  minWidth?: 'sm' | 'md' | 'lg'
}

export const Grid: React.FC<GridProps> = ({ 
  className, 
  minWidth = 'md',
  ...props 
}) => {
  const minWidthClasses = {
    sm: 'grid-cols-[repeat(auto-fill,minmax(300px,1fr))]',
    md: 'grid-cols-[repeat(auto-fill,minmax(400px,1fr))]',
    lg: 'grid-cols-[repeat(auto-fill,minmax(500px,1fr))]'
  };

  return (
    <div 
      className={cn(
        "grid gap-5",
        minWidthClasses[minWidth],
        className
      )}
      {...props}
    />
  );
};