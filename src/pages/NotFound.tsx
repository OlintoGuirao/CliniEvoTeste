import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="text-center max-w-sm">
        <h1 className="mb-3 text-3xl font-bold">404</h1>
        <p className="mb-3 text-sm sm:text-base text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-sm text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
