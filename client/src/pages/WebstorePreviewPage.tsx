export default function WebstorePreviewPage() {
  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webstore Preview</h1>
          <p className="text-gray-500 mt-1">Live mock webstore (hosted externally on Render)</p>
        </div>
        <a
          href="https://appcharge-mock-webstore.onrender.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          Open in new tab
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
      <iframe
        src="https://appcharge-mock-webstore.onrender.com/"
        className="flex-1 w-full rounded-lg border border-gray-200 bg-gray-900"
        title="Mock Webstore"
        allow="payment"
      />
    </div>
  );
}
