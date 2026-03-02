from passlib.context import CryptContext

def test_hashing():
    # Current configuration
    ctx_argon_only = CryptContext(schemes=["argon2"], deprecated="auto")
    
    # Configuration with both
    ctx_both = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")
    
    password = "password123"
    
    # Create a bcrypt hash (like an old user might have)
    ctx_bcrypt = CryptContext(schemes=["bcrypt"])
    bcrypt_hash = ctx_bcrypt.hash(password)
    print(f"Bcrypt hash: {bcrypt_hash}")
    
    # Create an argon2 hash
    argon_hash = ctx_argon_only.hash(password)
    print(f"Argon2 hash: {argon_hash}")
    
    print("\nTesting with argon2-only context:")
    try:
        match_argon = ctx_argon_only.verify(password, argon_hash)
        print(f"Verify argon2 with argon2-only: {match_argon}")
    except Exception as e:
        print(f"Error verifying argon2 with argon2-only: {e}")
        
    try:
        match_bcrypt = ctx_argon_only.verify(password, bcrypt_hash)
        print(f"Verify bcrypt with argon2-only: {match_bcrypt}")
    except Exception as e:
        # This is likely where it fails if the scheme is not recognized
        print(f"Error verifying bcrypt with argon2-only: {e}")
        
    print("\nTesting with both context:")
    try:
        match_argon_both = ctx_both.verify(password, argon_hash)
        print(f"Verify argon2 with both: {match_argon_both}")
        
        match_bcrypt_both = ctx_both.verify(password, bcrypt_hash)
        print(f"Verify bcrypt with both: {match_bcrypt_both}")
    except Exception as e:
        print(f"Error verifying with both: {e}")

if __name__ == "__main__":
    test_hashing()
