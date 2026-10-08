import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AutoDMProvider, useAutoDM } from '../../context/AutoDMContext';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon } from '@hugeicons/core-free-icons';

function AutoDMWorkspace() {
  const { hasSocialInstagramConnection, loading } = useAutoDM();
  const location = useLocation();
  const isEditorPage = location.pathname.includes('/automations/new') || (location.pathname.includes('/automations/') && location.pathname.split('/').length > 4);

  return (
    <section className={`autodm-shell ${isEditorPage ? '!p-0 !max-w-none' : ''}`}>
      {!hasSocialInstagramConnection && !loading && !isEditorPage ? (
        <div className="autodm-warning max-w-5xl mx-auto mt-6 w-[calc(100%-48px)]">
          <HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={1.8} />
          Connect Instagram in Social Pilot to sync AutoDM accounts and automations.
        </div>
      ) : null}

      <div className="autodm-content h-full">
        <Outlet />
      </div>
    </section>
  );
}

export default function AutoDMLayout() {
  return (
    <AutoDMProvider>
      <AutoDMWorkspace />
    </AutoDMProvider>
  );
}
