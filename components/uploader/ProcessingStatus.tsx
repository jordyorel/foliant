export function ProcessingStatus({label}: {label: string}) {
  return <div className="processing-status" role="status" aria-live="polite"><i className="ti ti-loader-2" aria-hidden="true" /><span>{label}</span></div>;
}
