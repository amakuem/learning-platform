import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Admin, { AdminUsers, AdminLogs, AdminDiscussions } from "../pages/Admin";

import Home from "../pages/home";
import Course from "../pages/Course";
import Login from "../pages/login";
import Register from "../pages/register";
import Profile from "../pages/Profile";
import MyCourses from "../pages/MyCourses";
import Learning from "../pages/Learning";
import InstructorEditor from "../pages/InstructorEditor";
import AccountRoute from "./AccountRoute";

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AccountRoute><Admin /></AccountRoute>}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="discussions" element={<AdminDiscussions />} />
        </Route>
        <Route path="/" element={<Home />} />
        <Route path="/courses/:courseId" element={<Course />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<AccountRoute><Profile /></AccountRoute>} />
        <Route path="/my-courses" element={<AccountRoute><MyCourses /></AccountRoute>} />
        <Route path="/learn/:courseId" element={<AccountRoute><Learning /></AccountRoute>} />
        <Route path="/instructor/courses/new" element={<AccountRoute><InstructorEditor /></AccountRoute>} />
        <Route path="/instructor/courses/:courseId" element={<AccountRoute><Course instructorPreview /></AccountRoute>} />
        <Route path="/instructor/courses/:courseId/edit" element={<AccountRoute><Course instructorPreview defaultEditing /></AccountRoute>} />
        <Route path="/instructor/courses/:courseId/preview" element={<AccountRoute><Learning instructorPreview /></AccountRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
