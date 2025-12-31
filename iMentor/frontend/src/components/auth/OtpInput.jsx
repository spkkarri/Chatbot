//frontend/src/components/auth/OtpInput.jsx

import React from 'react';
import { OTPInput } from 'input-otp';
import { cn } from '../../utils/cn'; // Import our new utility

const Slot = (props) => {
  return (
    <div
      className={cn(
        'relative w-12 h-16 text-[2rem] sm:w-14 sm:h-20 sm:text-[2.5rem]',
        'flex items-center justify-center',
        'transition-all duration-300',
        'border-border-light dark:border-border-dark border-y border-r first:border-l first:rounded-l-md last:rounded-r-md',
        'group-hover:border-primary/30 group-focus-within:border-primary/30',
        'outline outline-0 outline-primary/20',
        { 'outline-4 outline-primary': props.isActive },
        'bg-surface-light dark:bg-gray-800'
      )}
    >
      {props.char !== null && <div>{props.char}</div>}
      {props.hasFakeCaret && <FakeCaret />}
    </div>
  );
};

const FakeCaret = () => {
  return (
    <div className="absolute pointer-events-none inset-0 flex items-center justify-center animate-caret-blink">
      <div className="w-px h-8 bg-text-light dark:bg-text-dark" />
    </div>
  );
};

const FakeDash = () => {
  return (
    <div className="flex w-10 justify-center items-center">
      <div className="w-3 h-1 rounded-full bg-border-light dark:bg-border-dark" />
    </div>
  );
};

const OtpInputComponent = ({ otp, setOtp, onComplete }) => {
  return (
    <OTPInput
      value={otp}
      onChange={setOtp}
      onComplete={onComplete}
      maxLength={6}
      containerClassName="group flex items-center has-[:disabled]:opacity-30"
      render={({ slots }) => (
        <div className="flex justify-center w-full">
          <div className="flex">
            {slots.slice(0, 3).map((slot, idx) => (
              <Slot key={idx} {...slot} />
            ))}
          </div>
          <FakeDash />
          <div className="flex">
            {slots.slice(3).map((slot, idx) => (
              <Slot key={idx} {...slot} />
            ))}
          </div>
        </div>
      )}
    />
  );
};

export default OtpInputComponent;