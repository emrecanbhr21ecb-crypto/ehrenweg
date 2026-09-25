import { Navigate, Route, Routes } from 'react-router'

import { AppShell } from '@/components/AppShell'
import Activities from '@/pages/Activities'
import ActivityDetail from '@/pages/ActivityDetail'
import AdminPanel from '@/pages/admin/AdminPanel'
import Home from '@/pages/Home'
import { LegalIndex, LegalPageView } from '@/pages/Legal'
import ActivityForm from '@/pages/org/ActivityForm'
import OrgApplicants from '@/pages/org/OrgApplicants'
import OrgApply from '@/pages/org/OrgApply'
import AttendanceSession from '@/pages/org/AttendanceSession'
import LateScans from '@/pages/org/LateScans'
import OrgPanel from '@/pages/org/OrgPanel'
import Learn from '@/pages/Learn'
import Profile from '@/pages/Profile'
import Scan from '@/pages/Scan'
import TrainerApply from '@/pages/TrainerApply'
import Wallet from '@/pages/Wallet'
import ProfileEdit from '@/pages/ProfileEdit'

export default function App(): React.JSX.Element {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/activities/:activityId" element={<ActivityDetail />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/trainer/apply" element={<TrainerApply />} />
        <Route path="/legal" element={<LegalIndex />} />
        <Route path="/legal/:page" element={<LegalPageView />} />
        <Route path="/org" element={<OrgPanel />} />
        <Route path="/org/apply" element={<OrgApply />} />
        <Route path="/org/activities/new" element={<ActivityForm />} />
        <Route path="/org/activities/:activityId/edit" element={<ActivityForm />} />
        <Route
          path="/org/activities/:activityId/applicants"
          element={<OrgApplicants />}
        />
        <Route
          path="/org/activities/:activityId/attendance"
          element={<AttendanceSession />}
        />
        <Route path="/org/activities/:activityId/late-scans" element={<LateScans />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
