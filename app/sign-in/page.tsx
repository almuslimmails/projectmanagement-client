import SignInForm from './SignInForm'

export const metadata = { title: 'Sign in · Tathkarah Project Tracker' }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#3F0E40] via-[#4A154B] to-[#1A1A2E] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#3F0E40] px-8 pt-10 pb-7 text-center">
          <div className="w-14 h-14 rounded-xl bg-white text-[#3F0E40] flex items-center justify-center text-2xl font-extrabold mx-auto mb-3 shadow-md">M</div>
          <h1 className="text-xl font-extrabold text-white">Tathkarah Project Tracker</h1>
          <p className="text-[13px] text-white/70 mt-1">Sign in to continue</p>
        </div>
        <div className="p-8">
          <SignInForm next={next} />
        </div>
      </div>
    </div>
  )
}
