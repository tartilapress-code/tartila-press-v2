import InputField from '@/components/global_componets/InputField';
import { NavLink } from 'react-router-dom';

//data
import registrationPageOneData from '@/data/registration/registration_page_one.json';
import RegistrationPageNavigation from '@/components/registration/RegistrationPageNavigation';
import RegistrationCardHeader from '@/components/registration/RegistrationCardHeader';

export default function RegistrationPageOne() {
    return (
        <>
            <div className="flex flex-col gap-5 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6 w-100 ">
                <RegistrationCardHeader
                    link="/"
                    label="Home"
                    page_number="Page Three"
                />

                <div>
                    <h5 className="block text-white text-2xl font-semibold text-left">
                        Create an account
                    </h5>
                    <p className="text-white text-sm">
                        Lorem, ipsum dolor sit amet consectetur adipisicing
                        elit. Velit, ipsa!
                    </p>
                </div>

                {/*<form action="">*/}
                <div className="flex-col-4">
                    {registrationPageOneData.field.map((field) => (
                        <InputField
                            id={field.id}
                            label={field.label}
                            placeholder={field.placeholder}
                            stateValidationMessage={
                                field.state_validation_message
                            }
                            maxLength={field.max_length}
                            variant="invalid"
                        />
                    ))}

                    <RegistrationPageNavigation previousLink="/register/1" />
                </div>
                {/*</form>*/}
                <div className="flex-row-4">
                    <p className="text-sm">Already have an account?</p>
                    <NavLink
                        to="/login"
                        className="text-blue-800 text-sm hover:text-blue-700"
                    >
                        Login
                    </NavLink>
                </div>
            </div>
        </>
    );
}
