import BackgroundLayout from '@/components/BackgroundLayout';
import LoadingSkeleton from '@/components/LoadingSkeleton';

export default function MonitoreoMotoresLoading() {
  return (
    <BackgroundLayout>
      <div className="min-h-screen flex flex-col">
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 h-20"></div>
        
        <main className="pt-24 px-4 sm:px-6 lg:px-8 flex-grow">
          <div className="max-w-7xl mx-auto">
            <LoadingSkeleton type="page" lines={4} />
            <div className="mt-6">
              <LoadingSkeleton type="table" lines={5} />
            </div>
          </div>
        </main>
      </div>
    </BackgroundLayout>
  );
}
