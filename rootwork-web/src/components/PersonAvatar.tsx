import { initials, type Person } from "../data/people";
import { isImageMedia } from "../media/store";
import { useMediaUrl } from "../media/useMediaUrl";

type PersonAvatarProps = {
  person: Pick<Person, "givenName" | "familyName" | "photo">;
  className: string;
};

export function PersonAvatar({ person, className }: PersonAvatarProps) {
  const url = useMediaUrl(person.photo);
  const showPhoto = Boolean(url && isImageMedia(person.photo));

  return (
    <div className={`${className}${showPhoto ? " has-photo" : ""}`}>
      {showPhoto ? <img src={url ?? ""} alt="" className="media-cover" /> : initials(person)}
    </div>
  );
}
