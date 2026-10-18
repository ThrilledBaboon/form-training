import { CustomPages } from './CustomPages';
import { ProfileWelcome } from '../components/ProfileSetup';
export function Today() {
  return (
    <>
      <ProfileWelcome />
      <CustomPages overview />
    </>
  );
}
