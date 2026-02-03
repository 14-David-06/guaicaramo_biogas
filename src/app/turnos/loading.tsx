import BackgroundLayout from '@/components/BackgroundLayout';
import LoadingSkeleton from '@/components/LoadingSkeleton';

export default function TurnosLoading() {
  return (
    <BackgroundLayout>
      <div className="min-h-screen flex flex-col">
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 h-20"></div>
        
        <main className="pt-24 px-4 sm:px-6 lg:px-8 flex-grow">
          <div className="max-w-4xl mx-auto">
            <LoadingSkeleton type="form" lines={5} />
          </div>
        </main>
      </div>
    </BackgroundLayout>
  );
}
