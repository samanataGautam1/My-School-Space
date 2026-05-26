import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Badge } from "../components/ui/Shared";
import heroBg from "../assets/hero-bg.jpg";
import {
    BookOpen, Users, ChartBar, ShieldCheck, Mail, ArrowRight, Star,
    CheckCircle, LayoutDashboard, Calculator, Bus, Calendar,
    Library, DollarSign, Menu, X, GraduationCap, ChevronLeft, ChevronRight, Upload
} from "lucide-react";

export default function LandingPage() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-[#fffefe] font-inter text-green-900 overflow-x-hidden selection:bg-green-700 selection:text-green-900">

            {/* Navbar */}
            <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-lg shadow-sm py-4' : 'bg-transparent py-6'}`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-[17px] font-medium tracking-wide text-slate-800 uppercase">
                            Myschoolspace
                        </span>
                    </div>

                    <div className="hidden md:flex items-center gap-8  bg-green-950 px-6 py-2 rounded-lg border border-green-900 shadow-md">
                        <a
                            href="#features"
                            className="text-white! text-[11px] font-bold uppercase tracking-widest no-underline hover:text-green-200! transition-colors relative group"
                        >
                            Features
                        </a>

                        <a
                            href="#role-selection"
                            className="text-white! text-[11px] font-bold uppercase tracking-widest no-underline hover:text-green-200! transition-colors relative group"
                        >
                            Choose Role
                        </a>

                        <a
                            href="#about"
                            className="text-white! text-[11px] font-bold uppercase tracking-widest no-underline hover:text-green-200! transition-colors relative group"
                        >
                            About Us
                        </a>

                        <a
                            href="#support"
                            className="text-white! text-[11px] font-bold uppercase tracking-widest no-underline hover:text-green-200! transition-colors relative group"
                        >
                            Support
                        </a>
                    </div>


                    <button className="md:hidden text-slate-800" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        {mobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="absolute top-full left-0 w-full bg-white border-b border-slate-100 p-6 flex flex-col gap-4 md:hidden shadow-lg animate-fade-in-up">
                        <a href="#features" className="text-white font-medium" onClick={() => setMobileMenuOpen(false)}>Features</a>
                        <a href="#role-selection" className="text-white font-medium" onClick={() => setMobileMenuOpen(false)}>Choose Role</a>
                        <a href="#about" className="text-white font-medium" onClick={() => setMobileMenuOpen(false)}>About Us</a>
                        <a href="#support" className="text-white font-medium" onClick={() => setMobileMenuOpen(false)}>Support</a>
                        <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                            <Button variant="secondary" className="w-full justify-center">Log in</Button>
                        </Link>
                        <Link to="/role-selection" onClick={() => setMobileMenuOpen(false)}>
                            <Button className="w-full justify-center bg-green-950">Get Started</Button>
                        </Link>
                    </div>
                )}
            </nav>

            {/* Hero Section - Split Layout (UP School Style) */}
            <section className="relative pt-12 pb-24 px-12 md:px-16 overflow-hidden">
                <div className="max-w-7xl mx-auto">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left Column: Content */}
                        <div className="order-2 lg:order-1 text-left animate-fade-in-up mt-28">

                            <h1 className="text-[32px] font-bold tracking-tight mb-6 leading-tight text-slate-950">
                                Let's Create a Brilliant Future with<br />

                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-900 to-emerald-700">
                                    My School Space
                                </span>
                            </h1>

                            <p className="max-w-lg text-slate-600 text-lg mb-10 leading-relaxed font-medium">
                                Myschoolspace is a unified educational technology platform that is committed to providing high-quality management tools and implementing an intelligent, secure curriculum for modern schools.
                            </p>

                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                <Link to="/role-selection">
                                    <Button className="h-10 px-10 bg-green-950 text-white hover:bg-green-900 shadow-xl shadow-green-950/20 rounded-full transition-all hover:-translate-y-1 text-[13px] font-bold uppercase tracking-widest group">
                                        Get Started 
                                    </Button>
                                </Link>
                            
                                <Link to="/login">
                                   <Button variant="secondary" className="h-10 px-12 py-0 text-[12px] font-bold uppercase tracking-wider border-green-950/20 text-green-950 bg-white hover:bg-green-50 transition-colors">
                                      Log in
                                   </Button>
                                </Link>
                            </div>
                        </div>

                        <div className="order-1 lg:order-2 relative group mt-42 lg:mt-32">
                            {/* Decorative background shape */}
                            <div className="absolute inset-0 bg-green-100/30 rounded-tl-[6rem] rounded-br-[6rem] -rotate-3 -z-10 group-hover:rotate-0 transition-transform duration-700"></div>

                            <div className="relative rounded-tl-[5rem] rounded-br-[5rem] rounded-tr-3xl rounded-bl-3xl overflow-hidden shadow-2xl border-x-2 border-b-2 border-green-950 aspect-video lg:aspect-auto md:max-h-[420px]">
                                <img
                                    src={heroBg}
                                    alt="Modern Education"
                                    className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-1000"
                                />
                            </div>

                            {/* Floating Video Preview Card */}
                            <div className="absolute -bottom-10 -left-10 bg-white p-1 rounded-xl shadow-2xl border border-slate-100 hidden md:block animate-float z-20 w-[180px]">
                                <div className="flex flex-col">
                                    {/* Video Thumbnail Placeholder */}
                                    <div className="relative aspect-video bg-slate-900 rounded-t-lg overflow-hidden group/video cursor-pointer">
                                        <img
                                            src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=300"
                                            alt="School Demo"
                                            className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                                                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-0.5"></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attached Button with Matching Width */}
                                    <Button className="w-full h-8 bg-green-900 text-white text-[9px] font-extrabold uppercase tracking-widest rounded-b-lg rounded-t-none flex items-center  px-3 hover:bg-green-900 transition-colors">
                                        Watch Demo 
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid - "Trendy" Design */}
            <section id="features" className="pt-16 pb-24 bg-[#fffef9] relative border-t border-slate-100">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-8">
                        <h2 className="text-xs text-green-700 font-bold tracking-widest uppercase mb-2">Enterprise Capabilities</h2>
                        <h3 className="text-[32px] font-bold text-slate-950 mb-6 tracking-tight font-inter">Everything you need to run a modern school</h3>
                        <p className="text-slate-600 text-lg leading-relaxed font-inter">Detailed, role-based modules designed for seamless operations and enhanced productivity.</p>
                    </div>

                    {/* Feature Spotlight Box (Smart Attendance) - Fintech Inspired */}
                    <div className="mb-12 bg-[#fffefc] rounded-2xl p-6 md:p-8 border border-slate-100 shadow-xl shadow-green-950/5 relative overflow-hidden group">
                        {/* Decorative background blur */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-100/10 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>

                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            {/* Left Column */}
                            <div className="order-2 lg:order-1">
                                <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4 leading-tight tracking-tight">
                                    Real-time Attendance Tracking for Every Student
                                </h3>
                                <p className="text-slate-600 text-base leading-relaxed mb-6 max-w-md">
                                    Experience the freedom of automated attendance. Instantly notify parents, track trends, and eliminate manual register errors for a smarter campus.
                                </p>
                                
                            </div>

                            {/* Right Column (Mockup) */}
                            <div className="order-1 lg:order-2 relative">
                                {/* The main dashboard card */}
                                <div className="bg-white rounded-xl shadow-xl p-6 border border-slate-50 relative z-10 animate-float max-w-sm mx-auto">
                                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 ring-4 ring-slate-50">
                                                <img src="https://i.pravatar.cc/150?u=school1" alt="Student" className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">Arju Sharma</p>
                                                <p className="text-xs text-slate-400 font-medium">Class 10-A • Roll 12</p>
                                            </div>
                                        </div>
                                        <div className="bg-emerald-950 text-white border border-emerald-100 text-[10px] font-bold py-1 px-3 rounded-full">PRESENT</div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm font-medium">
                                            <span className="text-slate-500">Check-in Time</span>
                                            <span className="text-slate-900">08:45 AM</span>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="w-[92%] h-full bg-emerald-950 rounded-full"></div>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                <span>Attendance Health</span>
                                                <span className="text-emerald-950">92% Overall</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Marketplace - Dark High-Contrast Section */}
            <section className="py-10 bg-green-950 relative overflow-hidden border-t border-green-900">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FeatureCardModern
                            title="Teacher Rating"
                            description="Students can rate and review their teachers, fostering transparency and continuous improvement in education."
                        />
                        <FeatureCardModern
                            
                            title="Transparency"
                            description="Cultivating an open atmosphere of trust and accountability between parents, teachers, and school administration."
                        />
                        <FeatureCardModern
                           
                            title="Graphical Analysis"
                            description="Visual data insights for student performance, attendance trends, and financial reports for better decision making."
                        />
                        <FeatureCardModern
                           
                            title="Assignment Upload"
                            description="Seamless digital assignment submission for students with file support for PDF, DOCX, and images."
                        />
                        <FeatureCardModern
                            
                            title="Email System"
                            description="Integrated professional communication hub for instant updates, announcements, and direct messaging."
                        />
                        <FeatureCardModern
                           
                            title="Communication"
                            description="Integrated messaging system connecting teachers, parents, and admins with instant notifications."
                        />
                    </div>
                </div>
            </section>

            {/* About Us Section */}
            <section id="about" className="py-24 bg-[#fffef9] overflow-hidden border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-20">
                        <h2 className="text-[32px] font-bold text-slate-900 mb-6 tracking-tight">Empowering 500+ Schools</h2>
                        <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
                            Dedicated to streamlining school management and enhancing the learning experience through innovative technology.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-16 items-center mb-24">
                        <div className="relative group md:flex md:justify-end pr-4">
                            <div className="absolute top-6 -left-2 md:left-auto md:right-8 w-[85%] h-full bg-emerald-100 rounded-2xl -z-10 transition-transform group-hover:translate-x-2 group-hover:translate-y-2"></div>
                            <img src="/images/vision.png" alt="Our Vision" className="rounded-2xl shadow-xl relative z-10 w-full md:w-[85%] object-cover h-[260px] grayscale hover:grayscale-0 transition-all duration-500" />
                        </div>
                        <div>
                            <h3 className="text-[32px] font-bold text-slate-900 mb-6 tracking-tight">Our Vision</h3>
                            <p className="text-slate-600 text-lg leading-relaxed mb-6">
                                To create a world where education is seamless, accessible, and efficiently managed. We envision a future where administrative burdens are eliminated, allowing educators to focus entirely on inspiring the next generation.
                            </p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="order-2 md:order-1 pl-4">
                            <h3 className="text-[32px] font-bold text-slate-900 mb-6 tracking-tight">Our Mission</h3>
                            <p className="text-slate-600 text-lg leading-relaxed mb-6">
                                Providing schools with the most advanced, secure, and user-friendly tools. We are committed to bridging the gap between traditional education and modern technology, ensuring every stakeholder—from principals to parents—has the best experience possible.
                            </p>
                        </div>
                        <div className="order-1 md:order-2 relative group md:flex md:justify-start pl-4">
                            <div className="absolute -bottom-6 -right-2 md:right-auto md:left-8 w-[85%] h-full bg-green-100 rounded-2xl -z-10 transition-transform group-hover:-translate-x-2 group-hover:-translate-y-2"></div>
                            <img src="/images/mission.png" alt="Our Mission" className="rounded-2xl shadow-xl relative z-10 w-full md:w-[85%] object-cover h-[260px] grayscale hover:grayscale-0 transition-all duration-500" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Choose Your Role Section */}
            <section id="role-selection" className="py-24 bg-[#fffef9] relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-sm text-green-800 tracking-widest uppercase mb-3 font-bold">Get Started</h2>
                        <h3 className="text-[32px] font-bold text-green-950 mb-6 tracking-tight">Choose Your Role</h3>
                        <p className="text-slate-700 text-lg max-w-2xl mx-auto">
                            Select the role that best describes you to create your personalized account.
                        </p>
                    </div>

                    {/* Carousel Container */}
                    <div className="relative">
                        {/* Desktop View - Show 2 cards */}
                        <div className="hidden md:block">
                            <div className="grid grid-cols-2 gap-6">
                                {[
                                    {
                                        title: "Admin",
                                        description: "Manage your entire school operations, oversee staff, students, and control system settings.",
                                    
                                        color: "from-emerald-600 to-green-700",
                                        bgColor: "bg-emerald-50",
                                        route: "/admin-signup"
                                    },
                                    {
                                        title: "Teacher",
                                        description: "Manage your classes, track student progress, create assignments, and communicate with parents.",
                                        
                                        color: "from-blue-600 to-indigo-700",
                                        bgColor: "bg-blue-50",
                                        route: "/teacher-signup"
                                    },
                                    {
                                        title: "Student",
                                        description: "Access your courses, view assignments, check grades, and stay connected with your teachers.",
                                        
                                        color: "from-purple-600 to-pink-700",
                                        bgColor: "bg-purple-50",
                                        route: "/student-signup"
                                    },
                                    {
                                        title: "Parent",
                                        description: "Monitor your child's academic progress, attendance, and communicate with teachers and school staff.",
                                        
                                        color: "from-amber-600 to-orange-700",
                                        bgColor: "bg-amber-50",
                                        route: "/parent-signup"
                                    }
                                ].slice(carouselIndex, carouselIndex + 2).map((role, idx) => {
                                    const Icon = role.icon;
                                    return (
                                        <div key={idx} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100 group hover:-translate-y-1">
                                            <h4 className="text-xl font-bold text-slate-900 mb-2">{role.title}</h4>
                                            <p className="text-slate-600 text-sm leading-relaxed mb-6 min-h-[40px]">{role.description}</p>
                                            <Link to={role.route}>
                                                <Button className="w-full bg-green-950 hover:bg-green-900 text-white h-10 text-[10px] font-bold uppercase tracking-widest shadow-md  transition-all">
                                                    Sign Up as {role.title}
                                                </Button>
                                            </Link>
                                        </div>
                                    );

                                })}
                            </div>

                            {/* Navigation Arrows */}
                            <div className="flex justify-center gap-4 mt-8">
                                <button
                                    onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                                    disabled={carouselIndex === 0}
                                    className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-green-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-6 h-6 text-green-900" />
                                </button>
                                <button
                                    onClick={() => setCarouselIndex(Math.min(2, carouselIndex + 1))}
                                    disabled={carouselIndex === 2}
                                    className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-green-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-6 h-6 text-green-900" />
                                </button>
                            </div>
                        </div>

                        {/* Mobile View - Show 1 card with horizontal scroll */}
                        <div className="md:hidden overflow-x-auto scrollbar-hide">
                            <div className="flex gap-6 pb-4" style={{ scrollSnapType: 'x mandatory' }}>
                                {[
                                    {
                                        title: "Admin",
                                        description: "Manage your entire school operations, oversee staff, students, and control system settings.",
                                        
                                        color: "from-emerald-600 to-green-700",
                                        bgColor: "bg-emerald-50",
                                        route: "/admin-signup"
                                    },
                                    {
                                        title: "Teacher",
                                        description: "Manage your classes, track student progress, create assignments, and communicate with parents.",
                                        
                                        color: "from-blue-600 to-indigo-700",
                                        bgColor: "bg-blue-50",
                                        route: "/teacher-signup"
                                    },
                                    {
                                        title: "Student",
                                        description: "Access your courses, view assignments, check grades, and stay connected with your teachers.",
                                        
                                        color: "from-purple-600 to-pink-700",
                                        bgColor: "bg-purple-50",
                                        route: "/student-signup"
                                    },
                                    {
                                        title: "Parent",
                                        description: "Monitor your child's academic progress, attendance, and communicate with teachers and school staff.",
                                        
                                        color: "from-amber-600 to-orange-700",
                                        bgColor: "bg-amber-50",
                                        route: "/parent-signup"
                                    }
                                ].map((role, idx) => {
                                    const Icon = role.icon;
                                    return (
                                        <div key={idx} className="bg-white rounded-2xl p-6 shadow-md min-w-[260px] flex-shrink-0" style={{ scrollSnapAlign: 'start' }}>
                                            <h4 className="text-xl font-bold text-slate-900 mb-2">{role.title}</h4>
                                            <p className="text-slate-600 text-sm leading-relaxed mb-6">{role.description}</p>
                                            <Link to={role.route}>
                                                <Button className="w-5 h-10 text-[10px] uppercase font-bold tracking-widest bg-green-950 hover:bg-green-950 text-white">
                                                    Sign Up as {role.title}
                                                </Button>
                                            </Link>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Or view all roles link */}
                    <div className="text-center mt-12">
                        <Link to="/role-selection" className="inline-flex items-center gap-2 text-green-950 font-semibold hover:gap-3 transition-all">
                            View All Roles 
                        </Link>
                    </div>
                </div>
            </section>



            {/* Footer */}
            <footer id="support" className="bg-black text-slate-400 py-12 border-t border-slate-900">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                    <div className="col-span-2 lg:col-span-2">
                        <div className="flex items-center gap-2 mb-4 text-white">
                            <span className="text-[17px] font-medium tracking-wide text-white uppercase">Myschoolspace</span>
                        </div>
                        <p className="max-w-xs mb-6">The complete operating system for modern education institutions. Secure, scalable, and simple.</p>
                        <div className="flex gap-4">
                            {/* Social Icons Placeholder */}
                            {[1, 2, 3].map(i => <div key={i} className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center hover:bg-yellow-400 hover:text-green-950 transition-all cursor-pointer border border-slate-800"></div>)}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-4">Product</h4>
                        <ul className="space-y-4">
                            <li><a href="#features" className="hover:text-green-500 transition-colors">Features</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-4">Company</h4>
                        <ul className="space-y-4">
                            <li><a href="#about" className="hover:text-green-500 transition-colors">About Us</a></li>
                            <li><a href="#support" className="hover:text-green-500 transition-colors">Contact</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-4">Legal</h4>
                        <ul className="space-y-4">
                            <li><a href="#" className="hover:text-green-500 transition-colors">Privacy</a></li>
                            <li><a href="#" className="hover:text-green-500 transition-colors">Terms</a></li>
                            <li><a href="#" className="hover:text-green-500 transition-colors">Security</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 pt-6 mt-8 border-t border-slate-900 text-center md:text-left text-sm">
                    © 2024 Myschoolspace Inc. All rights reserved.
                </div>
            </footer>
        </div>
    );
}


function FeatureCardModern({ icon, title, description }) {
    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 hover:bg-white/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-white/5 group">
            <div className="w-10 h-10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{title}</h3>
            <p className="text-emerald-50/70 text-base leading-relaxed font-inter font-medium">{description}</p>
        </div>
    );
}
