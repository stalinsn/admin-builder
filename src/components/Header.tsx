import { CvData } from '@/types/cv';
import HeaderTitle from './Header/HeaderTitle';
import HeaderLocation from './Header/HeaderLocation';
import HeaderContacts from './Header/HeaderContacts';

type HeaderProps = {
  data: CvData;
};

export default function Header({ data }: HeaderProps) {
  return (
    <header className="text-center">
      <HeaderTitle
        name={data.name}
        title={data.title}
        githubProject={data.githubProject}
      />
      <HeaderLocation location={data.location} />
      <HeaderContacts
        phone={data.contact.phone}
        email={data.contact.email}
        linkedin={data.contact.linkedin}
      />
    </header>
  );
}
