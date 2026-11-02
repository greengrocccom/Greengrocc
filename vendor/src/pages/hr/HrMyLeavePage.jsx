import ApplyLeaveSection from '../../components/ApplyLeaveSection';
import opsApi from '../../api/opsApi';
import { useAuth } from '../../context/AuthContext';

export default function HrMyLeavePage() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <ApplyLeaveSection
        title="My leave"
        subtitle="Admins can apply for leave with one or more dates. HR can review requests under Leave."
        applicantName={user?.name || user?.email || 'Admin'}
        applyLeave={(payload) =>
          opsApi.create('hr/leaves/apply', payload).then((res) => res.data || res)
        }
        listMyLeaves={() =>
          opsApi.list('hr/leaves/mine').then((res) => res.data || [])
        }
      />
    </div>
  );
}
