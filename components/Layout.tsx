"use client"

import React from 'react'
import { usePathname } from 'next/navigation'
import NavBar from "@/framer/navigation/nav-bar"
import Footer from "@/framer/navigation/footer"

export default function Layout({ 
  children, 
  style 
}: { 
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const pathname = usePathname()
  
  // Map pathname to activePage prop
  const getActivePage = (): 'Home Active' | 'About Active' | 'Portfolio Active' | 'Contact Active' | 'All Not Active' => {
    if (pathname === '/') return 'Home Active'
    if (pathname === '/aboutme') return 'About Active'
    if (pathname === '/howitworks') return 'Portfolio Active'
    if (pathname === '/contact') return 'Contact Active'
    return 'All Not Active'
  }

  return (
    <div>
      <div style={{ position: "absolute", top: "0px", left: "0px", right: "0px", zIndex: 10 }}>
        <NavBar.Responsive style={{ width: '100%'}} activePage={getActivePage()} />
      </div>
      <div style={style}>
      {children}
      </div>
      <div style={{ position: "relative", zIndex: 10 }}>
      <Footer.Responsive style={{ width: '100%'}} />
      </div>
    </div>
  )
}