import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "../pages/home";
import Course from "../pages/Course";
import Login from "../pages/login";
import Register from "../pages/register";
import Profile from "../pages/Profile";
import MyCourses from "../pages/MyCourses";
import Learning from "../pages/Learning";
import AccountRoute from "./AccountRoute";

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses/:courseId" element={<Course />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<AccountRoute><Profile /></AccountRoute>} />
        <Route path="/my-courses" element={<AccountRoute><MyCourses /></AccountRoute>} />
        <Route path="/learn/:courseId" element={<AccountRoute><Learning /></AccountRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
