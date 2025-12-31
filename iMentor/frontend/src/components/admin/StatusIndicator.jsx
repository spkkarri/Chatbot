// frontend/src/components/admin/StatusIndicator.jsx
import React from 'react';
import { CheckCircle, Loader2, XCircle, SkipForward } from 'lucide-react';

const statusConfig = {
    pending: { Icon: Loader2, color: 'text-gray-400', label: 'Pending' },
    running: { Icon: Loader2, color: 'text-blue-500 animate-spin', label: 'Running' },
    completed: { Icon: CheckCircle, color: 'text-green-500', label: 'Completed' },
    failed: { Icon: XCircle, color: 'text-red-500', label: 'Failed' },
    skipped: { Icon: SkipForward, color: 'text-yellow-500', label: 'Skipped' }
};

const Step = ({ name, status }) => {
    const { Icon, color, label } = statusConfig[status] || statusConfig.pending;
    return (
        <div className="flex items-center gap-2" title={`${name}: ${label}`}>
            <Icon size={16} className={color} />
            <span className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark">{name}</span>
        </div>
    );
};

const StatusIndicator = ({ pipelineStatus }) => {
    if (!pipelineStatus) {
        return <Step name="Overall" status="completed" />;
    }

    return (
        <div className="flex items-center gap-4">
            <Step name="Parse & Vectorize" status={pipelineStatus.vectorDb || 'pending'} />
            <Step name="KG" status={pipelineStatus.kg || 'pending'} />
            <Step name="Analysis" status={pipelineStatus.analysis || 'pending'} />
        </div>
    );
};

export default StatusIndicator;
