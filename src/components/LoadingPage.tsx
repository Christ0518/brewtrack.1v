export default function LoadingPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="text-center">
        {/* Logo Container */}
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center">
            <svg
              className="w-16 h-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns=""
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6m0 0v6m0-6h6m0 0h6m0 0h-6m0 0h-6"
              />
            </svg>
          </div>
        </div>

        {/* Spinner */}
        <div className="mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600 mx-auto"></div>
        </div>

        {/* Loading Text */}
        <h2 className="text-2xl font-bold text-slate-900 mb-2">BrewTrack</h2>
        <p className="text-slate-600">Loading menu...</p>
      </div>
    </div>
  );
}
